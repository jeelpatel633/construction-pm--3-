import { useState, useEffect } from 'react';
import axios from 'axios';

const METHODS = ['cash','bank_transfer','cheque','upi','other'];
const BLANK   = { payment_date: new Date().toISOString().slice(0,10), amount:'', payment_method:'cash', reference:'', notes:'' };
const n       = v => parseFloat(v) || 0;
const INR     = v => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const methodLabel = m => m?.replace('_',' ').toUpperCase() || '—';
const methodClass = m => ({ cash:'m-cash', bank_transfer:'m-bank_transfer', cheque:'m-cheque', upi:'m-upi', other:'m-other' }[m] || 'm-other');

export default function PaymentsTab({ projectId, archTotal, contTotal, onChanged }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [editId,  setEditId]  = useState(null);
  const [busy,    setBusy]    = useState(false);

  const load = (notify = false) => {
    setLoading(true);
    axios.get(`/api/payments/${projectId}`)
      .then(r => { setRows(r.data); if (notify) onChanged?.(); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const set       = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const totalPaid = rows.reduce((s, r) => s + n(r.amount), 0);
  const totalBill = n(archTotal) + n(contTotal);
  const balance   = totalBill - totalPaid;

  const startEdit = row => {
    setEditId(row.id);
    setForm({ payment_date: row.payment_date?.slice(0,10)||'', amount: row.amount||'', payment_method: row.payment_method||'cash', reference: row.reference||'', notes: row.notes||'' });
    setOpen(true);
  };
  const cancel = () => { setOpen(false); setEditId(null); setForm(BLANK); };

  const save = async () => {
    if (!form.amount || !form.payment_date) return;
    setBusy(true);
    try {
      if (editId) await axios.put(`/api/payments/${editId}`, { ...form, project_id: projectId });
      else        await axios.post('/api/payments', { ...form, project_id: projectId });
      load(true); cancel();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this payment?')) return;
    await axios.delete(`/api/payments/${id}`); load(true);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Calculation breakdown — ✅ labels updated */}
      <div className="invoice-calc">
        {n(archTotal) > 0 && (
          <div className="calc-row">
            <span className="calc-label">📐 Actual Unit Invoice Total</span>
            <span className="calc-val" style={{ color:'var(--text-2)' }}>{INR(archTotal)}</span>
          </div>
        )}
        {n(contTotal) > 0 && (
          <div className="calc-row">
            <span className="calc-label">📊 Fix Unit Invoice Total</span>
            <span className="calc-val" style={{ color:'var(--text-2)' }}>{INR(contTotal)}</span>
          </div>
        )}
        <div className="calc-row highlight">
          <span className="calc-label" style={{ color:'#94A3B8', fontWeight:700 }}>TOTAL BILL</span>
          <span className="calc-val" style={{ color:'var(--accent)', fontSize:17 }}>{INR(totalBill)}</span>
        </div>
        <div className="calc-row">
          <span className="calc-label">➖ Advance / Payments Received</span>
          <span className="calc-val" style={{ color:'var(--success)' }}>{INR(totalPaid)}</span>
        </div>
        <div className={`calc-row balance ${balance <= 0 ? 'paid' : ''}`}>
          <span className="calc-label" style={{ fontWeight:700, fontSize:14 }}>
            {balance > 0 ? '🔴 Client Has to Pay' : '✅ Fully Paid'}
          </span>
          <span className="calc-val" style={{ fontSize:17 }}>{INR(Math.abs(balance))}</span>
        </div>
      </div>

      {/* Payments table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">💳</span> Payment History</div>
          <button className="btn btn-primary btn-sm" onClick={() => { cancel(); setOpen(true); }}>＋ Record Payment</button>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loader"><div className="spinner" /></div> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width:32 }}>#</th>
                  <th>Date</th>
                  <th className="right">Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th style={{ width:72 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="tbl-empty"><td colSpan={7}>No payments recorded yet.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted" style={{ fontSize:11 }}>{i+1}</td>
                    <td className="strong">{new Date(r.payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td className="right success">{INR(r.amount)}</td>
                    <td><span className={`method-badge ${methodClass(r.payment_method)}`}>{methodLabel(r.payment_method)}</span></td>
                    <td className="muted">{r.reference || '—'}</td>
                    <td className="muted" style={{ maxWidth:160, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.notes || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                        <button className="icon-btn" onClick={() => startEdit(r)}>✏️</button>
                        <button className="icon-btn danger" onClick={() => del(r.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="tbl-total">
                    <td colSpan={2} style={{ textAlign:'right', fontSize:11 }}>TOTAL PAID</td>
                    <td className="right">{INR(totalPaid)}</td>
                    <td colSpan={4} />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {open && (
          <div className="add-form payment-form-grid">
            <div className="form-col">
              <label className="form-lbl">Date *</label>
              <input className="form-input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            </div>
            <div className="form-col">
              <label className="form-lbl">Amount (₹) *</label>
              <input className="form-input" type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="form-col">
              <label className="form-lbl">Method</label>
              <select className="form-select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                {METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-col">
              <label className="form-lbl">Reference</label>
              <input className="form-input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Cheque no / UTR" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
            </div>
            <div className="form-actions">
              <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : (editId ? 'Update' : 'Record Payment')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}