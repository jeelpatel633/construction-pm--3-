import { useState, useEffect } from 'react';
import axios from 'axios';

const BLANK = {
  item_name: '', unit: '',
  l_ft: '', b_ft: '', h_ft: '',
  quantity: '', rate: '',
  additional_cost: '', tax_percent: '', notes: ''
};

const p  = v => parseFloat(v) || 0;
const INR = v => '₹' + p(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmt = v => p(v) === 0 ? '—' : p(v).toLocaleString('en-IN', { minimumFractionDigits: 3 });

// LBH calculation — matches backend logic
function calcLBH(l, b, h) {
  const L = p(l), B = p(b), H = p(h);
  if (L && B && H) return parseFloat((L * B * H).toFixed(3));
  if (L && B)      return parseFloat((L * B).toFixed(3));
  if (L && H)      return parseFloat((L * H).toFixed(3));
  if (L)           return parseFloat(L.toFixed(3));
  return 0;
}

function calcGT(form) {
  const lbh  = calcLBH(form.l_ft, form.b_ft, form.h_ft);
  const qty  = p(form.quantity);
  const rate = p(form.rate);
  const ac   = p(form.additional_cost);
  const tax  = p(form.tax_percent);
  const base = lbh > 0 ? lbh * (qty || 1) * rate : qty * rate;
  return base + ac + (base * tax / 100);
}

function lbhLabel(l, b, h) {
  const L = p(l), B = p(b), H = p(h);
  if (L && B && H) return `${L}×${B}×${H} = ${(L*B*H).toFixed(2)} cu.ft`;
  if (L && B)      return `${L}×${B} = ${(L*B).toFixed(2)} sq.ft`;
  if (L && H)      return `${L}×${H} = ${(L*H).toFixed(2)} sq.ft`;
  if (L)           return `${L} ft`;
  return '—';
}

export default function WorkTable({ projectId, apiPath, title, color = 'var(--accent)' }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [editId,  setEditId]  = useState(null);
  const [busy,    setBusy]    = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`/api/${apiPath}/${projectId}`)
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const set   = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const total = rows.reduce((s, r) => s + p(r.grand_total), 0);

  const startEdit = row => {
    setEditId(row.id);
    setForm({
      item_name:       row.item_name       || '',
      unit:            row.unit            || '',
      l_ft:            row.l_ft            || '',
      b_ft:            row.b_ft            || '',
      h_ft:            row.h_ft            || '',
      quantity:        row.quantity        || '',
      rate:            row.rate            || '',
      additional_cost: row.additional_cost || '',
      tax_percent:     row.tax_percent     || '',
      notes:           row.notes           || '',
    });
    setOpen(true);
  };

  const cancel = () => { setOpen(false); setEditId(null); setForm(BLANK); };

  const save = async () => {
    if (!form.item_name.trim()) return;
    setBusy(true);
    try {
      if (editId) {
        await axios.put(`/api/${apiPath}/${editId}`, { ...form, project_id: projectId });
      } else {
        await axios.post(`/api/${apiPath}`, { ...form, project_id: projectId });
      }
      load(); cancel();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this row?')) return;
    await axios.delete(`/api/${apiPath}/${id}`);
    load();
  };

  const lbh         = calcLBH(form.l_ft, form.b_ft, form.h_ft);
  const previewTotal = calcGT(form);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title" style={{ color }}>
            <span className="card-title-icon">{apiPath.includes('architect') ? '📐' : '📊'}</span>
            {title}
          </div>
          {rows.length > 0 && (
            <div className="card-subtitle">
              Total: <strong style={{ color }}>{INR(total)}</strong> &nbsp;·&nbsp; {rows.length} item{rows.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { cancel(); setOpen(true); }}>
          ＋ Add Item
        </button>
      </div>

      <div className="table-wrap">
        {loading ? <div className="loader"><div className="spinner" /></div> : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Item / Work</th>
                <th className="center">Unit</th>
                <th className="center">L (ft)</th>
                <th className="center">B (ft)</th>
                <th className="center">H (ft)</th>
                <th className="right">Area / Vol</th>
                <th className="right">Qty</th>
                <th className="right">Rate (₹)</th>
                <th className="right">Add. Cost</th>
                <th className="center">Tax %</th>
                <th className="right">Grand Total</th>
                <th>Notes</th>
                <th style={{ width: 64 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="tbl-empty"><td colSpan={14}>No items yet — click "Add Item" to start.</td></tr>
              ) : rows.map((r, i) => {
                const lbhVal = p(r.lbh_result);
                return (
                  <tr key={r.id}>
                    <td className="muted" style={{ fontSize: 11 }}>{i + 1}</td>
                    <td className="strong">{r.item_name}</td>
                    <td className="center muted">{r.unit || '—'}</td>
                    <td className="center">{r.l_ft ? p(r.l_ft) : '—'}</td>
                    <td className="center">{r.b_ft ? p(r.b_ft) : '—'}</td>
                    <td className="center">{r.h_ft ? p(r.h_ft) : '—'}</td>
                    <td className="right" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 12 }}>
                      {lbhVal > 0 ? (
                        <span title={lbhLabel(r.l_ft, r.b_ft, r.h_ft)}>
                          {lbhVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="right">{p(r.quantity) || '—'}</td>
                    <td className="right">{INR(r.rate)}</td>
                    <td className="right">{INR(r.additional_cost)}</td>
                    <td className="center">{p(r.tax_percent)}%</td>
                    <td className="right accent">{INR(r.grand_total)}</td>
                    <td className="note-cell muted" data-note={r.notes || 'No notes'}>
                      {r.notes || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => startEdit(r)} title="Edit">✏️</button>
                        <button className="icon-btn danger" onClick={() => del(r.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="tbl-total">
                  <td colSpan={11} style={{ textAlign: 'right', fontSize: 11, letterSpacing: 1 }}>GRAND TOTAL</td>
                  <td className="right">{INR(total)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Form */}
      {open && (
        <div className="add-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1: Item name + unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12 }}>
            <div className="form-col">
              <label className="form-lbl">Item / Work *</label>
              <input className="form-input" value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Tile Work, Brick Work" autoFocus />
            </div>
            <div className="form-col">
              <label className="form-lbl">Unit Label</label>
              <input className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="sq.ft / rmt" />
            </div>
          </div>

          {/* Row 2: LBH inputs + live result */}
          <div style={{ background: 'var(--blue-bg)', border: '1px solid #BFDBFE', borderRadius: 'var(--radius)', padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              📐 L × B × H Measurement (leave blank if not needed)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 12 }}>
              <div className="form-col">
                <label className="form-lbl">L — Length (ft)</label>
                <input className="form-input" type="number" min="0" step="0.001" value={form.l_ft} onChange={e => set('l_ft', e.target.value)} placeholder="0.000" />
              </div>
              <div className="form-col">
                <label className="form-lbl">B — Breadth (ft)</label>
                <input className="form-input" type="number" min="0" step="0.001" value={form.b_ft} onChange={e => set('b_ft', e.target.value)} placeholder="0.000" />
              </div>
              <div className="form-col">
                <label className="form-lbl">H — Height (ft)</label>
                <input className="form-input" type="number" min="0" step="0.001" value={form.h_ft} onChange={e => set('h_ft', e.target.value)} placeholder="0.000" />
              </div>
              <div className="form-col">
                <label className="form-lbl">Calculated Result</label>
                <div style={{
                  background: lbh > 0 ? '#EFF6FF' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 11px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: lbh > 0 ? 'var(--blue)' : 'var(--text-3)',
                }}>
                  {lbh > 0 ? lbhLabel(form.l_ft, form.b_ft, form.h_ft) : 'Fill L, B or H above'}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Quantity + Rate + Add Cost + Tax */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <div className="form-col">
              <label className="form-lbl">
                {lbh > 0 ? 'Qty (count / multiplier)' : 'Quantity'}
              </label>
              <input className="form-input" type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="1" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Rate (₹ per unit)</label>
              <input className="form-input" type="number" min="0" value={form.rate} onChange={e => set('rate', e.target.value)} placeholder="0" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Add. Cost (₹)</label>
              <input className="form-input" type="number" min="0" value={form.additional_cost} onChange={e => set('additional_cost', e.target.value)} placeholder="0" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Tax %</label>
              <input className="form-input" type="number" min="0" max="100" value={form.tax_percent} onChange={e => set('tax_percent', e.target.value)} placeholder="0" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Grand Total Preview</label>
              <div className="preview-val">{INR(previewTotal)}</div>
            </div>
          </div>

          {/* Row 4: Notes + formula display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-col">
              <label className="form-lbl">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
            </div>
            <div className="form-col">
              <label className="form-lbl">Calculation Breakdown</label>
              <div style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 11px', lineHeight: 1.7 }}>
                {lbh > 0 ? (
                  <>
                    <span style={{ color: 'var(--blue)' }}>{lbhLabel(form.l_ft, form.b_ft, form.h_ft)}</span>
                    {` × Qty(${p(form.quantity)||1}) × Rate(₹${p(form.rate)}) + Add.Cost(₹${p(form.additional_cost)}) + Tax`}
                  </>
                ) : (
                  `Qty(${p(form.quantity)}) × Rate(₹${p(form.rate)}) + Add.Cost(₹${p(form.additional_cost)}) + Tax`
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : (editId ? 'Update Row' : 'Add Row')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
