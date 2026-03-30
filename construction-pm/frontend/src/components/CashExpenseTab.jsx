import { useState, useEffect } from 'react';
import axios from 'axios';

const CATEGORIES = ['Materials', 'Labour', 'Subcontractor', 'Equipment', 'Transport', 'Other'];
const BLANK = {
  expense_date: new Date().toISOString().slice(0,10),
  category: 'Materials',
  description: '',
  amount: '',
  paid_to: '',
  notes: '',
};

const n   = v => parseFloat(v) || 0;
const INR = v => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const CAT_COLORS = {
  Materials:      { bg:'#EFF6FF', text:'#2563EB' },
  Labour:         { bg:'#FEF9C3', text:'#D97706' },
  Subcontractor:  { bg:'#F3E8FF', text:'#7C3AED' },
  Equipment:      { bg:'#DCFCE7', text:'#16A34A' },
  Transport:      { bg:'#FFF7ED', text:'#EA580C' },
  Other:          { bg:'#F1F5F9', text:'#64748B' },
};

export default function CashExpenseTab({ projectId, cashIn }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [editId,  setEditId]  = useState(null);
  const [busy,    setBusy]    = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`/api/cash-expenses/${projectId}`)
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const totalOut = rows.reduce((s, r) => s + n(r.amount), 0);
  const profit   = n(cashIn) - totalOut;

  const startEdit = row => {
    setEditId(row.id);
    setForm({
      expense_date: row.expense_date?.slice(0,10) || '',
      category:    row.category    || 'Materials',
      description: row.description || '',
      amount:      row.amount      || '',
      paid_to:     row.paid_to     || '',
      notes:       row.notes       || '',
    });
    setOpen(true);
  };
  const cancel = () => { setOpen(false); setEditId(null); setForm(BLANK); };

  const save = async () => {
    if (!form.amount) return;
    setBusy(true);
    try {
      if (editId) await axios.put(`/api/cash-expenses/${editId}`, { ...form, project_id: projectId });
      else        await axios.post('/api/cash-expenses', { ...form, project_id: projectId });
      load(); cancel();
    } catch(e) { console.error(e); }
    finally { setBusy(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this expense?')) return;
    await axios.delete(`/api/cash-expenses/${id}`);
    load();
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>

      {/* Summary cards */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
        <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 20px', position:'relative', overflow:'hidden'}}>
          <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.7, color:'var(--text-3)', marginBottom:6}}>Cash In (Received)</div>
          <div style={{fontSize:22, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--success)'}}>{INR(cashIn)}</div>
          <div style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:28, opacity:0.07}}>💰</div>
        </div>
        <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 20px', position:'relative', overflow:'hidden'}}>
          <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.7, color:'var(--text-3)', marginBottom:6}}>Cash Out (Expense)</div>
          <div style={{fontSize:22, fontWeight:800, fontFamily:'var(--font-mono)', color:totalOut>0?'var(--danger)':'var(--text-3)'}}>{INR(totalOut)}</div>
          <div style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:28, opacity:0.07}}>💸</div>
        </div>
        <div style={{background: profit>=0 ? '#F3E8FF' : '#FEF2F2', border:`1px solid ${profit>=0?'#DDD6FE':'#FECACA'}`, borderRadius:'var(--radius-lg)', padding:'16px 20px', position:'relative', overflow:'hidden'}}>
          <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.7, color:profit>=0?'#7C3AED':'var(--danger)', marginBottom:6}}>Net Profit (So Far)</div>
          <div style={{fontSize:22, fontWeight:800, fontFamily:'var(--font-mono)', color:profit>=0?'#7C3AED':'var(--danger)'}}>{INR(profit)}</div>
          <div style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:28, opacity:0.1}}>{profit>=0?'📈':'📉'}</div>
        </div>
      </div>

      {/* Expense table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="card-title-icon">💸</span>Cash Out — Expenses</div>
          <button className="btn btn-primary btn-sm" onClick={() => { cancel(); setOpen(true); }}>＋ Add Expense</button>
        </div>

        <div className="table-wrap">
          {loading ? <div className="loader"><div className="spinner"/></div> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width:32}}>#</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Paid To</th>
                  <th className="right">Amount</th>
                  <th>Notes</th>
                  <th style={{width:72}}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="tbl-empty"><td colSpan={8}>No expenses recorded yet. Click "Add Expense" to start.</td></tr>
                ) : rows.map((r, i) => {
                  const cc = CAT_COLORS[r.category] || CAT_COLORS.Other;
                  return (
                    <tr key={r.id}>
                      <td className="muted" style={{fontSize:11}}>{i+1}</td>
                      <td className="strong">{new Date(r.expense_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                      <td>
                        <span style={{display:'inline-block', background:cc.bg, color:cc.text, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:600}}>
                          {r.category}
                        </span>
                      </td>
                      <td>{r.description || '—'}</td>
                      <td className="muted">{r.paid_to || '—'}</td>
                      <td className="right" style={{color:'var(--danger)', fontWeight:700, fontFamily:'var(--font-mono)'}}>{INR(r.amount)}</td>
                      <td className="muted" style={{maxWidth:160, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.notes || '—'}</td>
                      <td>
                        <div style={{display:'flex', gap:5, justifyContent:'flex-end'}}>
                          <button className="icon-btn" onClick={() => startEdit(r)}>✏️</button>
                          <button className="icon-btn danger" onClick={() => del(r.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length > 0 && (
                  <tr className="tbl-total">
                    <td colSpan={5} style={{textAlign:'right', fontSize:11, letterSpacing:1}}>TOTAL EXPENSES</td>
                    <td className="right" style={{color:'var(--danger)'}}>{INR(totalOut)}</td>
                    <td colSpan={2}/>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / Edit Form */}
        {open && (
          <div className="add-form" style={{display:'flex', flexDirection:'column', gap:14}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
              <div className="form-col">
                <label className="form-lbl">Date *</label>
                <input className="form-input" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
              </div>
              <div className="form-col">
                <label className="form-lbl">Category</label>
                <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-col">
                <label className="form-lbl">Amount (₹) *</label>
                <input className="form-input" type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" autoFocus />
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12}}>
              <div className="form-col">
                <label className="form-lbl">Description</label>
                <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Cement 50 bags, Labour for foundation" />
              </div>
              <div className="form-col">
                <label className="form-lbl">Paid To</label>
                <input className="form-input" value={form.paid_to} onChange={e => set('paid_to', e.target.value)} placeholder="Vendor / Worker name" />
              </div>
            </div>
            <div className="form-col">
              <label className="form-lbl">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
            </div>
            <div className="form-actions">
              <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editId ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}