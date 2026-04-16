import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const BLANK      = { sr_no:'', description:'', unit:'', l_ft:'', b_ft:'', h_ft:'', quantity:'1', rate:'', notes:'' };
const BLANK_META = { invoice_number:'', invoice_date:'' };
const p   = v => parseFloat(v) || 0;
const INR = v => '₹' + p(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function calcLBH(l, b, h) {
  const L=p(l), B=p(b), H=p(h);
  if (L&&B&&H) return L*B*H;
  if (L&&B)    return L*B;
  if (L&&H)    return L*H;
  if (L)       return L;
  return 0;
}
function calcAmount(form) {
  const lbh = calcLBH(form.l_ft, form.b_ft, form.h_ft);
  const qty = p(form.quantity) || 1;
  return lbh > 0 ? lbh * qty * p(form.rate) : qty * p(form.rate);
}
function lbhLabel(l, b, h) {
  const L=p(l), B=p(b), H=p(h);
  if (L&&B&&H) return `${L}×${B}×${H} = ${(L*B*H).toFixed(2)} cu.ft`;
  if (L&&B)    return `${L}×${B} = ${(L*B).toFixed(2)} sq.ft`;
  if (L&&H)    return `${L}×${H} = ${(L*H).toFixed(2)} sq.ft`;
  if (L)       return `${L} ft`;
  return '—';
}

// ── Image compression — maximum quality for real-estate POC photos ────────────
// Strategy: preserve full resolution up to 2400px, quality 0.97, high-quality
// bicubic rendering, optional two-pass sharpening for small source images.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        // 2400px — 2× the old 1200px cap → significantly sharper in PDF
        const MAX   = 2400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const W     = Math.round(img.width  * scale);
        const H     = Math.round(img.height * scale);

        // Two-pass sharpening: if original image is small, draw at 2× first,
        // then downscale — browser bicubic produces a natural sharpen pass.
        const needsSharp = scale === 1 && Math.max(img.width, img.height) < 800;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Highest quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // White background — handles transparent PNGs cleanly in PDF
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        if (needsSharp) {
          // Render at 2× on temp canvas, then downscale for sharpening effect
          const tmp  = document.createElement('canvas');
          tmp.width  = W * 2;
          tmp.height = H * 2;
          const tctx = tmp.getContext('2d');
          tctx.imageSmoothingEnabled = true;
          tctx.imageSmoothingQuality = 'high';
          tctx.fillStyle = '#ffffff';
          tctx.fillRect(0, 0, tmp.width, tmp.height);
          tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
          ctx.drawImage(tmp, 0, 0, W, H);
        } else {
          ctx.drawImage(img, 0, 0, W, H);
        }

        // 0.97 quality = visually lossless, far sharper than old 0.92
        resolve(canvas.toDataURL('image/jpeg', 0.97));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Signature compression — lossless PNG output, max 1200px ──────────────────
// PNG is always better for signatures: sharp edges, zero JPEG ringing artifacts
// on ink strokes. Falls back to high-quality JPEG only if PNG is too large.
function compressSignature(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        // 1200px wide — 1.5× previous cap, sharper in PDF
        const MAX   = 1200;
        const scale = Math.min(1, MAX / img.width);
        const W     = Math.round(img.width  * scale);
        const H     = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // White background so transparent PNGs look clean on PDF
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);

        // PNG = lossless = no JPEG artifacts on signature strokes/edges
        // If PNG exceeds ~350 KB (e.g. photo-style signature), use 0.98 JPEG
        const pngData = canvas.toDataURL('image/png');
        const pngKb   = Math.round(pngData.length * 0.75 / 1024);
        if (pngKb <= 350) {
          resolve(pngData);  // lossless — best quality
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.98));  // near-lossless fallback
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── POC image hook — encapsulates all load/add/caption/delete/reorder logic ──
function usePocImages(projectId) {
  const [meta,        setMeta]        = useState([]);
  const [fullImages,  setFullImages]  = useState({});
  const [pocLoading,  setPocLoading]  = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const captionTimers = useRef({});

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/quotation-poc/${projectId}`);
      setMeta(Array.isArray(data) ? data : []);
    } catch(e) { console.error('POC meta load:', e); }
    finally { setPocLoading(false); }
  }, [projectId]);

  const loadFull = useCallback(async (id) => {
    if (fullImages[id]) return;
    try {
      const { data } = await axios.get(`/api/quotation-poc/image/${id}`);
      setFullImages(prev => ({ ...prev, [id]: data.image_data }));
    } catch(e) { console.error('POC image load:', id, e); }
  }, [fullImages]);

  const addImages = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const dataUri = await compressImage(file);
        const { data } = await axios.post(`/api/quotation-poc/${projectId}`, {
          image_data: dataUri,
          caption:    null,
        });
        setMeta(prev => [...prev, { id: data.id, caption: null, sort_order: data.sort_order }]);
        setFullImages(prev => ({ ...prev, [data.id]: dataUri }));
      }
    } catch(e) { console.error('POC upload:', e); alert('Upload failed: ' + (e.response?.data?.error || e.message)); }
    finally { setUploading(false); }
  }, [projectId]);

  const updateCaption = useCallback((id, caption) => {
    setMeta(prev => prev.map(m => m.id === id ? { ...m, caption } : m));
    clearTimeout(captionTimers.current[id]);
    captionTimers.current[id] = setTimeout(async () => {
      try {
        await axios.patch(`/api/quotation-poc/caption/${id}`, { caption: caption.trim() || null });
      } catch(e) { console.error('Caption save:', e); }
    }, 600);
  }, []);

  const deleteImage = useCallback(async (id) => {
    if (!window.confirm('Remove this photo from the PDF?')) return;
    await axios.delete(`/api/quotation-poc/${id}`).catch(console.error);
    setMeta(prev => prev.filter(m => m.id !== id));
    setFullImages(prev => { const n = {...prev}; delete n[id]; return n; });
  }, []);

  const moveUp = useCallback(async (id) => {
    setMeta(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      const reordered = next.map((m, i) => ({ ...m, sort_order: i }));
      axios.put(`/api/quotation-poc/reorder/${projectId}`, {
        order: reordered.map(m => ({ id: m.id, sort_order: m.sort_order })),
      }).catch(console.error);
      return reordered;
    });
  }, [projectId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  return { meta, fullImages, pocLoading, uploading, loadFull, addImages, updateCaption, deleteImage, moveUp };
}

// ── POC Image Thumbnail component ─────────────────────────────────────────────
function PocThumb({ item, fullImages, loadFull, updateCaption, deleteImage, moveUp, isFirst }) {
  const src = fullImages[item.id];

  useEffect(() => { loadFull(item.id); }, [item.id]);

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', background:'var(--bg2)', display:'flex', flexDirection:'column' }}>
      <div style={{ position:'relative', aspectRatio:'4/3', background:'#E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        {src ? (
          <img src={src} alt={item.caption || 'Project photo'}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          <div style={{ fontSize:28, opacity:0.3 }}>📷</div>
        )}
        <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:4 }}>
          {!isFirst && (
            <button
              onClick={() => moveUp(item.id)}
              title="Move up"
              style={{ background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', borderRadius:4, width:26, height:26, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
              ↑
            </button>
          )}
          <button
            onClick={() => deleteImage(item.id)}
            title="Remove"
            style={{ background:'rgba(185,28,28,0.75)', color:'#fff', border:'none', borderRadius:4, width:26, height:26, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ padding:'8px 10px' }}>
        <input
          value={item.caption || ''}
          onChange={e => updateCaption(item.id, e.target.value)}
          placeholder="Add caption (optional)"
          maxLength={200}
          style={{ width:'100%', border:'0.5px solid var(--border)', borderRadius:6, padding:'5px 8px', fontSize:12, color:'var(--text)', background:'var(--bg)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
        />
        {!item.caption && (
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3, fontStyle:'italic' }}>
            No caption — won't appear in PDF
          </div>
        )}
      </div>
    </div>
  );
}

// ── POC Section Card ──────────────────────────────────────────────────────────
function PocSection({ project }) {
  const { meta, fullImages, pocLoading, uploading, loadFull, addImages, updateCaption, deleteImage, moveUp } = usePocImages(project.id);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async e => {
    e.preventDefault();
    setDragOver(false);
    await addImages(e.dataTransfer.files);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">🏗️</span>
          Project Vision &amp; Concepts
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {meta.length > 0 && (
            <span style={{ fontSize:11, color:'var(--text-3)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, padding:'2px 10px' }}>
              {meta.length} photo{meta.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}>
            {uploading ? '⏳ Uploading…' : '+ Add Photos'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display:'none' }}
            onChange={e => addImages(e.target.files)}
          />
        </div>
      </div>

      <div style={{ padding:'18px 20px' }}>
        {!pocLoading && meta.length === 0 && (
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ display:'block', border:`2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius:'var(--radius)', padding:36, textAlign:'center', cursor:'pointer', background: dragOver ? 'var(--blue-bg)' : 'var(--bg2)', transition:'all 0.15s' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📸</div>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4 }}>
              Click or drag &amp; drop photos
            </div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:14 }}>
              Real-estate photos, site shots, concept references · Multiple files supported
            </div>
            <span style={{ background:'#1E293B', color:'#fff', padding:'7px 20px', borderRadius:7, fontSize:13, fontWeight:600 }}>
              Browse Files
            </span>
            <input
              type="file" accept="image/*" multiple style={{ display:'none' }}
              onChange={e => addImages(e.target.files)} />
          </label>
        )}

        {pocLoading && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[1,2].map(i => (
              <div key={i} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                <div style={{ aspectRatio:'4/3', background:'var(--bg2)' }} />
                <div style={{ padding:'8px 10px' }}>
                  <div style={{ height:28, background:'var(--bg2)', borderRadius:6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!pocLoading && meta.length > 0 && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {meta.map((item, idx) => (
                <PocThumb
                  key={item.id}
                  item={item}
                  fullImages={fullImages}
                  loadFull={loadFull}
                  updateCaption={updateCaption}
                  deleteImage={deleteImage}
                  moveUp={moveUp}
                  isFirst={idx === 0}
                />
              ))}
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{ border:`2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius:'var(--radius)', aspectRatio:'4/3', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', background: dragOver ? 'var(--blue-bg)' : 'var(--bg2)', transition:'all 0.15s', gap:8 }}>
                <div style={{ fontSize:28, opacity:0.4 }}>＋</div>
                <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>Add more</div>
                <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => addImages(e.target.files)} />
              </label>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14, padding:'8px 12px', background:'var(--blue-bg)', border:'1px solid #BFDBFE', borderRadius:'var(--radius)' }}>
              <span style={{ fontSize:14 }}>ℹ️</span>
              <span style={{ fontSize:12, color:'var(--blue)' }}>
                2 photos per row in PDF · Captions are optional · Use ↑ to reorder · Photos auto-saved on upload
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main QuotationTab component
// ─────────────────────────────────────────────────────────────────────────────
export default function QuotationTab({ project, pdfUrl = u => u }) {
  const [rows,           setRows]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [open,           setOpen]           = useState(false);
  const [form,           setForm]           = useState(BLANK);
  const [editId,         setEditId]         = useState(null);
  const [busy,           setBusy]           = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [meta,           setMeta]           = useState(BLANK_META);
  const [metaSaving,     setMetaSaving]     = useState(false);
  const [metaSaved,      setMetaSaved]      = useState(false);

  const [sigClient,    setSigClient]    = useState(project.sig_client     || '');
  const [sigCont,      setSigCont]      = useState(project.sig_contractor || '');
  const [sigContType,  setSigContType]  = useState('text');
  const [sigContImg,   setSigContImg]   = useState(project.sig_contractor_img || null);
  const [imgSizeKb,    setImgSizeKb]    = useState(null);
  const [sigSaving,    setSigSaving]    = useState(false);
  const [sigSaved,     setSigSaved]     = useState(false);

  const [dlLogs,       setDlLogs]       = useState([]);
  const [stmts,        setStmts]        = useState([]);
  const [newStmt,      setNewStmt]      = useState('');
  const [waPopup,      setWaPopup]      = useState(null);
  const [waSending,    setWaSending]    = useState(false);
  const [showTotalInPdf, setShowTotalInPdf] = useState(true);

  const isDirtySig    = useRef(false);
  const autoSaveTimer = useRef(null);

  const load = () => {
    setLoading(true);
    axios.get(`/api/quotation/${project.id}`)
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadMeta = () => {
    axios.get(`/api/quotation/meta/${project.id}`)
      .then(r => setMeta({
        invoice_number: r.data.invoice_number || '',
        invoice_date:   r.data.invoice_date ? r.data.invoice_date.slice(0,10) : '',
      }))
      .catch(console.error);
  };

  useEffect(() => {
    load();
    loadMeta();
    axios.get(`/api/quotation-statements/${project.id}`).then(r => setStmts(Array.isArray(r.data) ? r.data : [])).catch(console.error);
    axios.get(`/api/download-logs/${project.id}?type=quotation`).then(r => setDlLogs(r.data)).catch(console.error);
    setSigClient(project.sig_client     || '');
    setSigCont(project.sig_contractor   || '');
    setSigContImg(project.sig_contractor_img || null);
    setSigContType(project.sig_contractor_img ? 'image' : 'text');
    if (project.sig_contractor_img) {
      setImgSizeKb(Math.round(project.sig_contractor_img.length * 0.75 / 1024));
    }
  }, [project.id]);

  const triggerAutoSave = (updatedMeta) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setMetaSaving(true);
      try {
        await axios.patch(`/api/quotation/meta/${project.id}`, updatedMeta);
        setMetaSaved(true);
        setTimeout(() => setMetaSaved(false), 2000);
      } catch(e) { console.error(e); }
      finally { setMetaSaving(false); }
    }, 800);
  };

  const setM = (k, v) => {
    const updated = { ...meta, [k]: v };
    setMeta(updated);
    triggerAutoSave(updated);
  };

  const addStmt = async () => {
    const trimmed = newStmt.trim();
    if (!trimmed) return;
    const alreadyExists = stmts.some(s => s.statement.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) { alert('This statement is already added'); return; }
    const updated = [...stmts, { id: Date.now(), statement: trimmed }];
    setStmts(updated);
    setNewStmt('');
    await axios.post(`/api/quotation-statements/bulk/${project.id}`, {
      statements: updated.map(s => s.statement)
    }).catch(console.error);
  };

  const removeStmt = async id => {
    const updated = stmts.filter(s => s.id !== id);
    setStmts(updated);
    await axios.post(`/api/quotation-statements/bulk/${project.id}`, { statements: updated.map(s => s.statement) }).catch(console.error);
  };

  const saveSig = async () => {
    if (!isDirtySig.current) return;
    setSigSaving(true);
    try {
      await axios.put(`/api/projects/${project.id}`, {
        project_name:       project.project_name,
        location:           project.location,
        start_date:         project.start_date ? project.start_date.slice(0,10) : null,
        end_date:           project.end_date   ? project.end_date.slice(0,10)   : null,
        status:             project.status,
        notes:              project.notes,
        invoice_notes:      project.invoice_notes,
        sig_client:         sigClient,
        sig_contractor:     sigCont,
        sig_contractor_img: sigContType === 'image' ? (sigContImg || null) : null,
        commission_percent: project.commission_percent || 3,
        invoice_number:     project.invoice_number,
        invoice_date:       project.invoice_date ? project.invoice_date.slice(0,10) : null,
      });
      isDirtySig.current = false;
      setSigSaved(true);
      setTimeout(() => setSigSaved(false), 2000);
    } catch(e) { console.error(e); }
    finally { setSigSaving(false); }
  };

  const markSigDirty = () => { isDirtySig.current = true; };

  const set   = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const total = rows.reduce((s, r) => s + p(r.amount), 0);
  const lbh   = calcLBH(form.l_ft, form.b_ft, form.h_ft);

  const startEdit = row => {
    setEditId(row.id);
    setForm({ sr_no:row.sr_no||'', description:row.description||'', unit:row.unit||'', l_ft:row.l_ft||'', b_ft:row.b_ft||'', h_ft:row.h_ft||'', quantity:row.quantity||'1', rate:row.rate||'', notes:row.notes||'' });
    setOpen(true);
  };
  const cancel = () => { setOpen(false); setEditId(null); setForm(BLANK); };

  const save = async () => {
    if (!form.description.trim()) return;
    setBusy(true);
    try {
      if (editId) await axios.put(`/api/quotation/${editId}`, { ...form, project_id: project.id });
      else        await axios.post('/api/quotation', { ...form, project_id: project.id });
      load(); cancel();
    } catch(e) { console.error(e); }
    finally { setBusy(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this row?')) return;
    await axios.delete(`/api/quotation/${id}`);
    load();
  };

  const flushMeta = async () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    try {
      await axios.patch(`/api/quotation/meta/${project.id}`, meta);
    } catch(e) { console.error(e); }
  };

  const downloadPdf = async () => {
    await flushMeta();
    await saveSig();
    try {
      const res = await axios.post('/api/download-logs', {
        project_id:   project.id,
        client_name:  project.client_name,
        project_name: project.project_name,
        pdf_type:     'quotation',
        total_amount: total,
      });
      const logData = res.data;
      setDlLogs(prev => [logData, ...prev]);
      window.open(pdfUrl(`/api/quotation-pdf/${project.id}?logId=${logData.id}`), '_blank');
      setTimeout(() => setWaPopup(logData), 500);
    } catch(e) {
      console.error(e);
      window.open(pdfUrl(`/api/quotation-pdf/${project.id}&showTotal=${showTotalInPdf?'1':'0'}`), '_blank');
    }
  };

  const previewPdf = async () => {
    setPreviewLoading(true);
    try {
      await flushMeta();
      await saveSig();
      window.open(pdfUrl(`/api/quotation-pdf/${project.id}?preview=1&showTotal=${showTotalInPdf?'1':'0'}&t=${Date.now()}`), '_blank');
    } catch(e) { alert('Preview failed. Try Download.'); }
    finally { setPreviewLoading(false); }
  };

  const sendWhatsApp = async (log) => {
    if (waSending) return;
    setWaSending(true);
    try {
      const { data } = await axios.get(`/api/download-logs/whatsapp/${log.id}`);
      const phone = data.phone ? data.phone.replace(/\D/g, '') : null;
      if (!phone) { alert('No phone number found for this client!'); return; }
      const pdfLink = data.resolved_pdf_url;
      const amount = data.total_amount
        ? '₹' + parseFloat(data.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        : '';
      const date = new Date(data.downloaded_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const message = [
        `Hello ${data.client_name}! 👋`,
        ``,
        `Your *Quotation* from *Navyakar* is ready.`,
        ``,
        `🏗️ *Project:* ${data.project_name}`,
        `${amount ? `💰 *Total Amount:* ${amount}` : ''}`,
        `📅 *Date:* ${date}`,
        ``,
        `📄 *Download your Quotation PDF:*`,
        `${pdfLink}`,
        ``,
        `_Valid for 30 days from date of issue._`,
        `_For queries, call: *+91 99242 81746*_`,
        ``,
        `— *Dhaval Mevada*`,
        `*Navyakar | Building Dreams, Crafting Reality* 🏠`,
      ].filter(line => line !== null && !(line === '' && false)).join('\n');
      const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      setWaPopup(null);
    } catch(e) {
      console.error(e);
      alert('Could not open WhatsApp. Please try again.');
    } finally {
      setWaSending(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {waPopup && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,maxWidth:420,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{fontSize:24,marginBottom:8,textAlign:'center'}}>📱</div>
            <div style={{fontWeight:700,fontSize:16,color:'#1E293B',textAlign:'center',marginBottom:6}}>Send on WhatsApp?</div>
            <div style={{fontSize:13,color:'#64748B',textAlign:'center',marginBottom:20}}>
              Send quotation PDF link to <strong>{waPopup.client_name}</strong>
              {waPopup.total_amount && <span> · ₹{parseFloat(waPopup.total_amount).toLocaleString('en-IN')}</span>}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setWaPopup(null)}
                style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid #CBD5E1',background:'#F8FAFC',color:'#64748B',fontWeight:600,cursor:'pointer',fontSize:14}}>
                Cancel
              </button>
              <button onClick={() => sendWhatsApp(waPopup)} disabled={waSending}
                style={{flex:2,padding:'10px',borderRadius:8,border:'none',background:waSending?'#86efac':'#25D366',color:'#fff',fontWeight:700,cursor:waSending?'not-allowed':'pointer',fontSize:14,transition:'all 0.2s'}}>
                {waSending ? '⏳ Preparing...' : '📱 Open WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Details Card ── */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#1E293B 0%,#0F172A 100%)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'#F97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧾</div>
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Quotation Details</div>
              <div style={{ color:'#94A3B8', fontSize:11, marginTop:1 }}>Auto-saved when you make changes</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, background: metaSaved?'#022c22':metaSaving?'#1c1917':'#1E293B', border:`1px solid ${metaSaved?'#16a34a':metaSaving?'#44403c':'#334155'}`, borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600, color:metaSaved?'#4ade80':metaSaving?'#a8a29e':'#475569', transition:'all 0.3s' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:metaSaved?'#4ade80':metaSaving?'#f59e0b':'#475569', boxShadow:metaSaving?'0 0 6px #f59e0b':'none', transition:'all 0.3s' }} />
            {metaSaved ? 'Saved' : metaSaving ? 'Saving…' : 'Up to date'}
          </div>
        </div>
        <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:0.8 }}>Quotation Number</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#94A3B8', pointerEvents:'none' }}>#</span>
              <input className="form-input" value={meta.invoice_number} onChange={e=>setM('invoice_number',e.target.value)} placeholder={`QUO-${project.id}`} style={{ paddingLeft:28, fontWeight:600, fontSize:14 }} />
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:0.8 }}>Quotation Date</label>
            <input className="form-input" type="date" value={meta.invoice_date} onChange={e=>setM('invoice_date',e.target.value)} style={{ fontWeight:600, fontSize:14 }} />
          </div>
        </div>
      </div>

      {/* ── Quotation Items Card ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><span className="card-title-icon">📋</span>Quotation Items</div>
            {rows.length > 0 && (
              <div className="card-subtitle">Total: <strong style={{color:'var(--accent)'}}>{INR(total)}</strong> · {rows.length} item{rows.length>1?'s':''}</div>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { cancel(); setOpen(true); }}>＋ Add Item</button>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loader"><div className="spinner" /></div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width:32}}>Sr.</th>
                  <th>Description</th>
                  <th className="center">Unit</th>
                  <th className="center">L (ft)</th>
                  <th className="center">B (ft)</th>
                  <th className="center">H (ft)</th>
                  <th className="right">Area / Vol</th>
                  <th className="right">Qty</th>
                  <th className="right">Rate (₹)</th>
                  <th className="right">Amount</th>
                  <th>Notes</th>
                  <th style={{width:64}}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="tbl-empty"><td colSpan={12}>No quotation items yet. Click "Add Item" to start.</td></tr>
                ) : rows.map((r,i) => {
                  const lbhVal = p(r.lbh_result);
                  return (
                    <tr key={r.id}>
                      <td className="muted center" style={{fontSize:11}}>{r.sr_no||i+1}</td>
                      <td className="strong">{r.description}</td>
                      <td className="center muted">{r.unit||'—'}</td>
                      <td className="center">{r.l_ft?p(r.l_ft):'—'}</td>
                      <td className="center">{r.b_ft?p(r.b_ft):'—'}</td>
                      <td className="center">{r.h_ft?p(r.h_ft):'—'}</td>
                      <td className="right" style={{color:lbhVal>0?'var(--blue)':'var(--text-3)',fontWeight:lbhVal>0?700:400}}>
                        {lbhVal>0?lbhVal.toLocaleString('en-IN',{maximumFractionDigits:2}):'—'}
                      </td>
                      <td className="right">{p(r.quantity)||1}</td>
                      <td className="right">{INR(r.rate)}</td>
                      <td className="right accent">{INR(r.amount)}</td>
                      <td className="note-cell muted" data-note={r.notes||'No notes'}>{r.notes||'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                          <button className="icon-btn" onClick={()=>startEdit(r)}>✏️</button>
                          <button className="icon-btn danger" onClick={()=>del(r.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length > 0 && (
                  <tr className="tbl-total">
                    <td colSpan={9} style={{textAlign:'right',fontSize:11,letterSpacing:1}}>TOTAL AMOUNT</td>
                    <td className="right">{INR(total)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {open && (
          <div className="add-form" style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'80px 3fr 1fr',gap:12}}>
              <div className="form-col"><label className="form-lbl">Sr. No</label><input className="form-input" type="number" value={form.sr_no} onChange={e=>set('sr_no',e.target.value)} placeholder="1" /></div>
              <div className="form-col"><label className="form-lbl">Description *</label><input className="form-input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. RCC Column Work, Tile Flooring" autoFocus /></div>
              <div className="form-col"><label className="form-lbl">Unit</label><input className="form-input" value={form.unit} onChange={e=>set('unit',e.target.value)} placeholder="sq.ft / rmt" /></div>
            </div>
            <div style={{background:'var(--blue-bg)',border:'1px solid #BFDBFE',borderRadius:'var(--radius)',padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:0.8,marginBottom:10}}>📐 L × B × H (optional)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 2fr',gap:12}}>
                <div className="form-col"><label className="form-lbl">L — Length (ft)</label><input className="form-input" type="number" step="0.001" value={form.l_ft} onChange={e=>set('l_ft',e.target.value)} placeholder="0.000" /></div>
                <div className="form-col"><label className="form-lbl">B — Breadth (ft)</label><input className="form-input" type="number" step="0.001" value={form.b_ft} onChange={e=>set('b_ft',e.target.value)} placeholder="0.000" /></div>
                <div className="form-col"><label className="form-lbl">H — Height (ft)</label><input className="form-input" type="number" step="0.001" value={form.h_ft} onChange={e=>set('h_ft',e.target.value)} placeholder="0.000" /></div>
                <div className="form-col">
                  <label className="form-lbl">Result</label>
                  <div style={{background:lbh>0?'#EFF6FF':'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 11px',fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:lbh>0?'var(--blue)':'var(--text-3)'}}>
                    {lbh>0?lbhLabel(form.l_ft,form.b_ft,form.h_ft):'Fill L, B or H above'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div className="form-col"><label className="form-lbl">{lbh>0?'Qty (multiplier)':'Quantity'}</label><input className="form-input" type="number" value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="1" /></div>
              <div className="form-col"><label className="form-lbl">Rate (₹)</label><input className="form-input" type="number" value={form.rate} onChange={e=>set('rate',e.target.value)} placeholder="0" /></div>
              <div className="form-col"><label className="form-lbl">Amount Preview</label><div className="preview-val">{INR(calcAmount(form))}</div></div>
            </div>
            <div className="form-col"><label className="form-lbl">Notes</label><input className="form-input" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes..." /></div>
            <div className="form-actions">
              <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy?'Saving…':editId?'Update':'Add Row'}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Project Vision & Concepts ── */}
      <PocSection project={project} />

      {/* ── Terms & Conditions ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">📋</span>Terms &amp; Conditions</div>
          <span style={{fontSize:11,color:'var(--text-3)'}}>Shown in Quotation PDF only</span>
        </div>
        <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div className="form-lbl" style={{marginBottom:8}}>Quick templates</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[
                'Payment to be made within 7 days of quotation acceptance',
                '50% advance required before work commencement',
                'Any additional work will be charged separately',
                'Materials to be approved by client before purchase',
                'Prices valid for 30 days from quotation date',
                'Site must be accessible during working hours (9AM – 6PM)',
                'GST applicable as per government norms',
                'Completion timeline subject to material availability',
              ].map(t => (
                <button key={t} className="btn btn-outline btn-sm" style={{fontSize:11}}
                  onClick={() => setNewStmt(t)}>
                  + {t.slice(0,38)}{t.length>38?'…':''}
                </button>
              ))}
            </div>
          </div>
          <div className="stmt-input-row">
            <input className="form-input" value={newStmt} onChange={e=>setNewStmt(e.target.value)}
              placeholder="Type a term or condition..." onKeyDown={e=>e.key==='Enter'&&addStmt()} />
            <button className="btn btn-primary btn-sm" onClick={addStmt}>Add</button>
          </div>
          {stmts.length > 0 && (
            <div className="stmt-list">
              {stmts.map(s => (
                <div key={s.id} className="stmt-item">
                  <div className="stmt-item-dot" />
                  <div className="stmt-item-text">{s.statement}</div>
                  <button className="icon-btn danger" style={{width:24,height:24,fontSize:11}} onClick={()=>removeStmt(s.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Signature Card ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">✍️</span>Signature Labels</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'var(--text-3)'}}>Shared with Invoice PDF</span>
            <div style={{display:'flex',alignItems:'center',gap:6,background:sigSaved?'#022c22':sigSaving?'#1c1917':'transparent',border:`1px solid ${sigSaved?'#16a34a':sigSaving?'#44403c':'transparent'}`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:600,color:sigSaved?'#4ade80':sigSaving?'#a8a29e':'transparent',transition:'all 0.3s'}}>
              {(sigSaved||sigSaving)&&<div style={{width:6,height:6,borderRadius:'50%',background:sigSaved?'#4ade80':'#f59e0b'}} />}
              {sigSaved?'Saved':sigSaving?'Saving…':''}
            </div>
          </div>
        </div>
        <div style={{padding:24}}>
          <div className="sig-row" style={{gap:32}}>
            <div className="sig-box" style={{flex:1}}>
              <div className="sig-label" style={{fontSize:13,fontWeight:600,marginBottom:12}}>Client Name / Label</div>
              <div className="sig-line" style={{marginBottom:14}} />
              <input className="form-input" value={sigClient} onChange={e=>{setSigClient(e.target.value);markSigDirty();}} onBlur={saveSig} placeholder="Leave empty to hide" />
            </div>
            <div className="sig-box" style={{flex:1}}>
              <div className="sig-label" style={{fontSize:13,fontWeight:600,marginBottom:12}}>Contractor / Architect</div>
              <div className="sig-line" style={{marginBottom:14}} />
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <button onClick={()=>{setSigContType('text');markSigDirty();}} style={{padding:'6px 18px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',background:sigContType==='text'?'#1E293B':'transparent',color:sigContType==='text'?'#fff':'#64748B',border:'1px solid #CBD5E1',transition:'all 0.15s'}}>✏️ Text</button>
                <button onClick={()=>{setSigContType('image');markSigDirty();}} style={{padding:'6px 18px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',background:sigContType==='image'?'#1E293B':'transparent',color:sigContType==='image'?'#fff':'#64748B',border:'1px solid #CBD5E1',transition:'all 0.15s'}}>🖼️ Image</button>
              </div>
              {sigContType === 'text' && (
                <input className="form-input" value={sigCont} onChange={e=>{setSigCont(e.target.value);markSigDirty();}} onBlur={saveSig} placeholder="e.g. Dhaval Mevada" style={{fontSize:14}} />
              )}
              {sigContType === 'image' && (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {sigContImg ? (
                    <div style={{padding:20,background:'#fff',borderRadius:12,border:'2px solid #E2E8F0',textAlign:'center',minHeight:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                      <img src={sigContImg} alt="Signature" style={{maxHeight:90,maxWidth:'100%',objectFit:'contain'}} />
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
                        {imgSizeKb && (<span style={{fontSize:11,color:'#16A34A',fontWeight:600,background:'#F0FDF4',padding:'2px 8px',borderRadius:20,border:'1px solid #BBF7D0'}}>✅ {imgSizeKb} KB · High Quality</span>)}
                        <button onClick={()=>{setSigContImg(null);setImgSizeKb(null);markSigDirty();setTimeout(saveSig,100);}} style={{fontSize:12,color:'#DC2626',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontWeight:600}}>✕ Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{padding:28,background:'#F8FAFC',borderRadius:12,border:'2px dashed #CBD5E1',textAlign:'center',cursor:'pointer',display:'block'}}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={async e=>{
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (!file) return;
                        const compressed = await compressSignature(file);
                        const kb = Math.round(compressed.length*0.75/1024);
                        setSigContImg(compressed); setImgSizeKb(kb); markSigDirty();
                        setTimeout(saveSig, 100);
                      }}>
                      <div style={{fontSize:32,marginBottom:8}}>🖊️</div>
                      <div style={{fontSize:14,fontWeight:600,color:'#334155',marginBottom:4}}>Click or Drag &amp; Drop signature</div>
                      <div style={{fontSize:12,color:'#94A3B8',marginBottom:12}}>PNG recommended · Auto white background · Lossless quality preserved</div>
                      <input type="file" accept="image/*" style={{display:'none'}}
                        onChange={async e=>{
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            const compressed = await compressSignature(file);
                            const kb = Math.round(compressed.length*0.75/1024);
                            setSigContImg(compressed); setImgSizeKb(kb); markSigDirty();
                            setTimeout(saveSig, 100);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => { setSigContImg(reader.result); markSigDirty(); setTimeout(saveSig,100); };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <span style={{background:'#1E293B',color:'#fff',padding:'7px 20px',borderRadius:7,fontSize:13,fontWeight:600}}>Browse File</span>
                    </label>
                  )}
                  <input className="form-input" value={sigCont} onChange={e=>{setSigCont(e.target.value);markSigDirty();}} onBlur={saveSig} placeholder="Name label below signature (optional)" style={{fontSize:13}} />
                </div>
              )}
            </div>
          </div>
          <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}>
            <button className="btn btn-outline btn-sm" onClick={()=>{isDirtySig.current=true;saveSig();}} disabled={sigSaving}>
              {sigSaving?'Saving…':'💾 Save Signatures'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Download History ── */}
      {dlLogs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">📥</span>Download History</div>
            <span style={{fontSize:11,color:'var(--text-3)'}}>{dlLogs.length} download{dlLogs.length>1?'s':''}</span>
          </div>
          <div style={{padding:'0 0 4px'}}>
            {dlLogs.slice(0,5).map((log,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:18}}>📋</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:'var(--text)',fontSize:13}}>Quotation PDF — {log.client_name}</div>
                  <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>
                    {new Date(log.downloaded_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} at {new Date(log.downloaded_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {log.id && (
                    <button onClick={() => window.open(pdfUrl(`/api/download-logs/view/${log.id}`), '_blank')}
                      style={{fontSize:11,fontWeight:600,color:'#2563EB',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>
                      👁️ View
                    </button>
                  )}
                  {log.id && (
                    <button onClick={() => setWaPopup(log)}
                      style={{fontSize:11,fontWeight:600,color:'#16A34A',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>
                      📱 WhatsApp
                    </button>
                  )}
                  <span style={{fontSize:11,fontWeight:600,color:'var(--success)',background:'#F0FDF4',padding:'2px 8px',borderRadius:20,border:'1px solid #BBF7D0'}}>✓ Sent</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PDF Actions ── */}
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',alignItems:'center',flexWrap:'wrap'}}>
        <div style={{fontSize:12,color:'var(--text-3)'}}>Generate a professional quotation PDF with client &amp; project details</div>

        {/* Total Amount toggle */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:20,cursor:'pointer'}} onClick={()=>setShowTotalInPdf(v=>!v)}>
          <div style={{width:32,height:18,borderRadius:9,background:showTotalInPdf?'#F97316':'#CBD5E1',transition:'background 0.2s',position:'relative',flexShrink:0}}>
            <div style={{position:'absolute',top:2,left:showTotalInPdf?14:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
          </div>
          <span style={{fontSize:12,fontWeight:600,color:showTotalInPdf?'var(--text)':'var(--text-3)',whiteSpace:'nowrap'}}>
            Show Total in PDF
          </span>
        </div>

        <button className="btn btn-outline" onClick={previewPdf} disabled={previewLoading}>
          {previewLoading?'⏳ Loading…':'👁️ Preview Quotation'}
        </button>
        <button className="btn btn-accent btn-lg" onClick={downloadPdf}>⬇️ Download Quotation PDF</button>
      </div>
    </div>
  );
}