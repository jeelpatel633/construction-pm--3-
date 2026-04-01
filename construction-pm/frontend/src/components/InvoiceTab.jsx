import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const n   = v => parseFloat(v) || 0;
const INR = v => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function InvoiceTab({ project, archTotal, contTotal, onProjectUpdated }) {
  const [stmts,       setStmts]       = useState([]);
  const [newStmt,     setNewStmt]     = useState('');
  const [invNotes,    setInvNotes]    = useState(project.invoice_notes  || '');
  const [sigClient,   setSigClient]   = useState(project.sig_client     || '');
  const [sigCont,     setSigCont]     = useState(project.sig_contractor || '');
  const [sigContType, setSigContType] = useState('text');
  const [sigContImg,  setSigContImg]  = useState(project.sig_contractor_img || null);
  const [commission,  setCommission]  = useState(project.commission_percent ?? 3);
  const [invoiceNum,  setInvoiceNum]  = useState(project.invoice_number || '');
  const [invoiceDate, setInvoiceDate] = useState(
    project.invoice_date ? project.invoice_date.slice(0,10) : new Date().toISOString().slice(0,10)
  );
  const [saving,      setSaving]      = useState(false);
  const [previewing,  setPreviewing]  = useState(false);
  const [payments,    setPayments]    = useState([]);
  const [imgSizeKb,   setImgSizeKb]   = useState(null);
 const [dlLogs,      setDlLogs]      = useState([]);   // ✅ Download history
const [waPopup,     setWaPopup]     = useState(null); // ✅ WhatsApp popup

  const isDirty = useRef(false);
  const markDirty = () => { isDirty.current = true; };

  const totalBill = n(archTotal) + n(contTotal);

  useEffect(() => {
    axios.get(`/api/statements/${project.id}`).then(r => setStmts(r.data)).catch(console.error);
    axios.get(`/api/payments/${project.id}`).then(r => setPayments(r.data)).catch(console.error);
    // ✅ Load download logs
    axios.get(`/api/download-logs/${project.id}?type=invoice`).then(r => setDlLogs(r.data)).catch(console.error);
    setInvNotes(project.invoice_notes  || '');
    setSigClient(project.sig_client    || '');
    setSigCont(project.sig_contractor  || '');
    setSigContImg(project.sig_contractor_img || null);
    setSigContType(project.sig_contractor_img ? 'image' : 'text');
    setCommission(project.commission_percent ?? 3);
    setInvoiceNum(project.invoice_number || '');
    setInvoiceDate(project.invoice_date ? project.invoice_date.slice(0,10) : new Date().toISOString().slice(0,10));
    isDirty.current = false;
    if (project.sig_contractor_img) {
      setImgSizeKb(Math.round(project.sig_contractor_img.length * 0.75 / 1024));
    } else {
      setImgSizeKb(null);
    }
  }, [project.id]);

  const totalPaid  = payments.reduce((s,r) => s + n(r.amount), 0);
  const balance    = totalBill - totalPaid;
  const commEarned = parseFloat((totalBill * n(commission) / 100).toFixed(2));

  const addStmt = () => {
    const trimmed = newStmt.trim();
    if (!trimmed) return;
    const alreadyExists = stmts.some(s => s.statement.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) {
      alert('This statement is already added');
      return;
    }
    setStmts(p => [...p, { id: Date.now(), statement: trimmed }]);
    setNewStmt('');
    markDirty();
  };
  const removeStmt = id => { setStmts(p => p.filter(s => s.id !== id)); markDirty(); };

  const saveAll = async () => {
    if (!isDirty.current) return;
    setSaving(true);
    try {
      await Promise.all([
        axios.post(`/api/statements/bulk/${project.id}`, { statements: stmts.map(s => s.statement) }),
        axios.put(`/api/projects/${project.id}`, {
          project_name:       project.project_name,
          location:           project.location,
          start_date:         project.start_date ? project.start_date.slice(0,10) : null,
          end_date:           project.end_date   ? project.end_date.slice(0,10)   : null,
          status:             project.status,
          notes:              project.notes,
          invoice_notes:      invNotes,
          sig_client:         sigClient,
          sig_contractor:     sigCont,
          sig_contractor_img: sigContType === 'image' ? (sigContImg || null) : null,
          commission_percent: parseFloat(commission) || 3,
          invoice_number:     invoiceNum,
          invoice_date:       invoiceDate,
        }),
      ]);
      isDirty.current = false;
      onProjectUpdated?.();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSave = async () => { isDirty.current = true; await saveAll(); };

  // ✅ Download + log
const downloadPdf = async () => {
    isDirty.current = true;
    await saveAll();
    try {
      const res = await axios.post('/api/download-logs', {
        project_id:   project.id,
        client_name:  project.client_name,
        project_name: project.project_name,
        pdf_type:     'invoice',
        total_amount: totalBill, // ✅ save total amount
      });
      const logData = res.data;
      setDlLogs(prev => [logData, ...prev]);
      window.open(`/api/pdf/${project.id}?logId=${logData.id}`, '_blank');
      // ✅ Show WhatsApp popup after short delay
      setTimeout(() => setWaPopup(logData), 500);
    } catch(e) {
      console.error(e);
      window.open(`/api/pdf/${project.id}`, '_blank');
    }
  };
  
  const previewPdf = async () => {
    setPreviewing(true);
    try {
      await saveAll();
      window.open(`/api/pdf/${project.id}?preview=1&t=${Date.now()}`, '_blank');
    } catch(e) {
      alert('Preview failed. Try Download.');
    } finally {
      setPreviewing(false);
    }
  };

  const TEMPLATES = [
    `Work will be completed by ${project.end_date ? new Date(project.end_date).toLocaleDateString('en-IN') : 'agreed date'}`,
    'Payment to be made within 7 days of invoice',
    '50% advance required before work commencement',
    'Any additional work will be charged separately',
    'Materials to be approved by client before purchase',
    'Site must be accessible during working hours (9AM – 6PM)',
  ];

  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) +
    ' ' + new Date(d).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});

// ✅ WhatsApp send function
const sendWhatsApp = async (log) => {
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
        `Your *Invoice* from *Navyakar* is ready.`,
        ``,
        `🏗️ *Project:* ${data.project_name}`,
        `${amount ? `💰 *Total Bill:* ${amount}` : ''}`,
        `📅 *Date:* ${date}`,
        ``,
        `📄 *Download your Invoice PDF:*`,
        `${pdfLink}`,
        ``,
        `_Payment due within 7 days of invoice._`,
        `_For queries, call: *+91 99242 81746*_`,
        ``,
        `— *Dhaval Mevada*`,
        `*Navyakar | Building Dreams, Crafting Reality* 🏠`,
      ].join('\n');

      const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      setWaPopup(null);
    } catch(e) {
      console.error(e);
      alert('Could not open WhatsApp. Please try again.');
    }
  };
  
  return (
    <div className="invoice-layout">

      {/* ✅ WhatsApp Popup */}
      {waPopup && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,maxWidth:420,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{fontSize:24,marginBottom:8,textAlign:'center'}}>📱</div>
            <div style={{fontWeight:700,fontSize:16,color:'#1E293B',textAlign:'center',marginBottom:6}}>Send on WhatsApp?</div>
            <div style={{fontSize:13,color:'#64748B',textAlign:'center',marginBottom:20}}>
              Send invoice PDF link to <strong>{waPopup.client_name}</strong>
              {waPopup.total_amount && <span> · ₹{parseFloat(waPopup.total_amount).toLocaleString('en-IN')}</span>}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setWaPopup(null)}
                style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid #CBD5E1',background:'#F8FAFC',color:'#64748B',fontWeight:600,cursor:'pointer',fontSize:14}}>
                Cancel
              </button>
              <button onClick={() => sendWhatsApp(waPopup)}
                style={{flex:2,padding:'10px',borderRadius:8,border:'none',background:'#25D366',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14}}>
                📱 Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice meta */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">🔢</span>Invoice Details</div>
        </div>
        <div style={{ padding:18, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          <div className="form-col">
            <label className="form-lbl">Invoice Number</label>
            <input className="form-input" value={invoiceNum} onChange={e=>{setInvoiceNum(e.target.value);markDirty();}} placeholder="e.g. INV-2024-001" />
          </div>
          <div className="form-col">
            <label className="form-lbl">Invoice Date</label>
            <input className="form-input" type="date" value={invoiceDate} onChange={e=>{setInvoiceDate(e.target.value);markDirty();}} />
          </div>
        </div>
      </div>

      {/* Financial calculation */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">💰</span>Financial Calculation</div>
        </div>
        <div className="invoice-calc">
          {n(archTotal) > 0 && (<div className="calc-row"><span className="calc-label">📐 Actual Unit Invoice Total</span><span className="calc-val" style={{color:'var(--text)'}}>{INR(archTotal)}</span></div>)}
          {n(contTotal) > 0 && (<div className="calc-row"><span className="calc-label">📊 Fix Unit Invoice Total</span><span className="calc-val" style={{color:'var(--text)'}}>{INR(contTotal)}</span></div>)}
          {n(archTotal) > 0 && n(contTotal) > 0 && (<div className="calc-row" style={{background:'var(--accent-bg)'}}><span className="calc-label" style={{color:'var(--accent)'}}>Combined Total</span><span className="calc-val" style={{color:'var(--accent)'}}>{INR(totalBill)}</span></div>)}
          <div className="calc-row highlight">
            <span className="calc-label" style={{color:'#94A3B8',fontWeight:700}}>TOTAL BILL (Client Has to Pay)</span>
            <span className="calc-val" style={{color:'var(--accent)',fontSize:17}}>{INR(totalBill)}</span>
          </div>
          <div className="calc-row">
            <span className="calc-label">➖ Total Payments / Advance Received</span>
            <span className="calc-val" style={{color:'var(--success)'}}>{INR(totalPaid)}</span>
          </div>
          <div className={`calc-row balance ${balance<=0?'paid':''}`}>
            <span className="calc-label" style={{fontWeight:700,fontSize:14}}>{balance>0?'🔴 BALANCE DUE — Client Has to Pay':'✅ FULLY PAID — No Balance Due'}</span>
            <span className="calc-val" style={{fontSize:18}}>{INR(Math.abs(balance))}</span>
          </div>
        </div>
      </div>

      {/* Terms & Statements */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">📋</span>Terms & Statements</div>
          <span style={{fontSize:11,color:'var(--text-3)'}}>Bullet points in PDF</span>
        </div>
        <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div className="form-lbl" style={{marginBottom:8}}>Quick templates</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {TEMPLATES.map(t => (
                <button key={t} className="btn btn-outline btn-sm" style={{fontSize:11}}
                      onClick={() => {
                      const exists = stmts.some(s => s.statement.toLowerCase() === t.toLowerCase());
                      if (exists) {
                        alert('This statement is already added');
                        return;
                      }
                      setStmts(p => [...p, { id: Date.now(), statement: t }]);
                      markDirty();
                    }}>
                  + {t.slice(0,40)}{t.length>40?'…':''}
                </button>
              ))}
            </div>
          </div>
          <div className="stmt-input-row">
            <input className="form-input" value={newStmt} onChange={e=>setNewStmt(e.target.value)}
              placeholder="Type a custom statement..." onKeyDown={e=>e.key==='Enter'&&addStmt()} />
            <button className="btn btn-primary btn-sm" onClick={addStmt}>Add</button>
          </div>
          {stmts.length>0 && (
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

      {/* Additional Notes */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">📝</span>Additional Invoice Notes</div>
        </div>
        <div style={{padding:18}}>
          <textarea className="form-textarea" rows={3} value={invNotes}
            onChange={e=>{setInvNotes(e.target.value);markDirty();}}
            placeholder="Extra notes to include at the bottom of the PDF..." />
        </div>
      </div>

      {/* Signatures */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">✍️</span>Signature Labels</div>
          <span style={{fontSize:11,color:'var(--text-3)'}}>Leave empty to hide from PDF</span>
        </div>
        <div style={{padding:24}}>
          <div className="sig-row" style={{gap:32}}>
            <div className="sig-box" style={{flex:1}}>
              <div className="sig-label" style={{fontSize:13,fontWeight:600,marginBottom:12}}>Client Name / Label</div>
              <div className="sig-line" style={{marginBottom:14}} />
              <input className="form-input" value={sigClient} onChange={e=>{setSigClient(e.target.value);markDirty();}} placeholder="Leave empty to hide" />
            </div>
            <div className="sig-box" style={{flex:1}}>
              <div className="sig-label" style={{fontSize:13,fontWeight:600,marginBottom:12}}>Contractor / Architect</div>
              <div className="sig-line" style={{marginBottom:14}} />
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <button onClick={()=>{setSigContType('text');markDirty();}} style={{padding:'6px 18px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',background:sigContType==='text'?'#1E293B':'transparent',color:sigContType==='text'?'#fff':'#64748B',border:'1px solid #CBD5E1',transition:'all 0.15s'}}>✏️ Text</button>
                <button onClick={()=>{setSigContType('image');markDirty();}} style={{padding:'6px 18px',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',background:sigContType==='image'?'#1E293B':'transparent',color:sigContType==='image'?'#fff':'#64748B',border:'1px solid #CBD5E1',transition:'all 0.15s'}}>🖼️ Image</button>
              </div>
              {sigContType === 'text' && (
                <input className="form-input" value={sigCont} onChange={e=>{setSigCont(e.target.value);markDirty();}} placeholder="e.g. Dhaval Mevada" style={{fontSize:14}} />
              )}
              {sigContType === 'image' && (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {sigContImg ? (
                    <div style={{padding:20,background:'#fff',borderRadius:12,border:'2px solid #E2E8F0',textAlign:'center',minHeight:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                      <img src={sigContImg} alt="Signature" style={{maxHeight:90,maxWidth:'100%',objectFit:'contain'}} />
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
                        {imgSizeKb && (
                          <span style={{fontSize:11,color:'#16A34A',fontWeight:600,background:'#F0FDF4',padding:'2px 8px',borderRadius:20,border:'1px solid #BBF7D0'}}>
                            ✅ {imgSizeKb} KB · High Quality
                          </span>
                        )}
                        <button onClick={()=>{setSigContImg(null);setImgSizeKb(null);markDirty();}} style={{fontSize:12,color:'#DC2626',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontWeight:600}}>✕ Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{padding:28,background:'#F8FAFC',borderRadius:12,border:'2px dashed #CBD5E1',textAlign:'center',cursor:'pointer',display:'block'}}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={async e=>{
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (!file) return;
                        const compressed = await compressImage(file);
                        const kb = Math.round(compressed.length * 0.75 / 1024);
                        setSigContImg(compressed); setImgSizeKb(kb); markDirty();
                      }}>
                      <div style={{fontSize:32,marginBottom:8}}>🖊️</div>
                      <div style={{fontSize:14,fontWeight:600,color:'#334155',marginBottom:4}}>Click or Drag & Drop signature</div>
                      <div style={{fontSize:12,color:'#94A3B8',marginBottom:12}}>PNG recommended · Auto white background · High quality preserved</div>
                      <input type="file" accept="image/*" style={{display:'none'}}
                        onChange={async e=>{
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            const compressed = await compressImage(file);
                            const kb = Math.round(compressed.length * 0.75 / 1024);
                            setSigContImg(compressed); setImgSizeKb(kb); markDirty();
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => { setSigContImg(reader.result); markDirty(); };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <span style={{background:'#1E293B',color:'#fff',padding:'7px 20px',borderRadius:7,fontSize:13,fontWeight:600}}>Browse File</span>
                    </label>
                  )}
                  <input className="form-input" value={sigCont} onChange={e=>{setSigCont(e.target.value);markDirty();}}
                    placeholder="Name label below signature (optional)" style={{fontSize:13}} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Download History */}
      {dlLogs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="card-title-icon">📥</span>Download History</div>
            <span style={{fontSize:11,color:'var(--text-3)'}}>{dlLogs.length} download{dlLogs.length>1?'s':''}</span>
          </div>
          <div style={{padding:'0 0 4px'}}>
            {dlLogs.slice(0,5).map((log,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:18}}>📄</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:'var(--text)',fontSize:13}}>Invoice PDF — {log.client_name}</div>
                  <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>
                    Forwarded to client on {fmtDate(log.downloaded_at)}
                  </div>
                </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {log.id && (
                  <button
                    onClick={() => window.open(`/api/download-logs/view/${log.id}`, '_blank')}
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

      {/* Actions */}
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
        <button className="btn btn-outline" onClick={handleSave} disabled={saving||previewing}>
          {saving ? 'Saving…' : '💾 Save'}
        </button>
        <button className="btn btn-outline btn-lg" onClick={previewPdf} disabled={saving||previewing}>
          {previewing ? '⏳ Saving…' : '👁️ Preview PDF'}
        </button>
        <button className="btn btn-accent btn-lg" onClick={downloadPdf} disabled={saving||previewing}>
          {saving ? 'Saving…' : '⬇️ Download PDF'}
        </button>
      </div>
    </div>
  );
}