import { useState, useEffect, useRef } from 'react';
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
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [open,        setOpen]        = useState(false);
  const [form,        setForm]        = useState(BLANK);
  const [editId,      setEditId]      = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [search,      setSearch]      = useState('');

  // ── Autocomplete state ───────────────────────────────────────────────────
  const [vendors,       setVendors]       = useState([]);   // all past paid_to names
  const [suggestions,   setSuggestions]   = useState([]);   // filtered list shown
  const [showSuggest,   setShowSuggest]   = useState(false);
  const [confirmVendor, setConfirmVendor] = useState(null); // name pending confirmation
  const paidToRef = useRef(null);
  const [pendingVendors, setPendingVendors] = useState([]);
  const [showPending,    setShowPending]    = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`/api/cash-expenses/${projectId}`)
      .then(r => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadPending = () => {
  axios.get(`/api/vendor-bills/summary/${projectId}`)
    .then(r => {
      const { payments, bills } = r.data;
      // Build total paid per vendor
      const paidMap = {};
      payments.forEach(p => {
        const key = (p.paid_to || '').toLowerCase().trim();
        paidMap[key] = (paidMap[key] || 0) + parseFloat(p.total_paid || 0);
      });
      // Build total billed per vendor
      const billedMap = {};
      bills.forEach(b => {
        const key = (b.vendor_name || '').toLowerCase().trim();
        if (!billedMap[key]) billedMap[key] = { name: b.vendor_name, total: 0 };
        billedMap[key].total += parseFloat(b.bill_amount || 0);
      });
      // Find vendors with a due amount
      const pending = Object.values(billedMap)
        .map(v => ({
          ...v,
          paid: paidMap[v.name.toLowerCase().trim()] || 0,
          due:  Math.max(0, v.total - (paidMap[v.name.toLowerCase().trim()] || 0)),
        }))
        .filter(v => v.due > 0);
      setPendingVendors(pending);
    })
    .catch(console.error);
};

  // ── Load vendors list for autocomplete ──────────────────────────────────
  const loadVendors = () => {
    axios.get(`/api/cash-expenses/vendors/${projectId}`)
      .then(r => setVendors(r.data))
      .catch(console.error);
  };

useEffect(() => { load(); loadVendors(); loadPending(); }, [projectId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const totalOut = rows.reduce((s, r) => s + n(r.amount), 0);
  const profit   = n(cashIn) - totalOut;

  const filteredRows = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.paid_to || '').toLowerCase().includes(q) ||
      String(r.amount).includes(q)
    );
  });

  // ── Paid To input handler ────────────────────────────────────────────────
  const handlePaidToChange = (val) => {
    set('paid_to', val);
    if (!val.trim()) { setSuggestions([]); setShowSuggest(false); return; }
    const q = val.trim().toLowerCase();
    const filtered = vendors.filter(v =>
      v.paid_to.toLowerCase().includes(q)
    );
    setSuggestions(filtered);
    setShowSuggest(true);
  };

  // User picks a suggestion from dropdown
  const pickSuggestion = (vendor) => {
    set('paid_to', vendor.paid_to);
    // Auto-fill category if it matches one of our categories
    if (vendor.category && CATEGORIES.includes(vendor.category)) {
      set('category', vendor.category);
    }
    setSuggestions([]);
    setShowSuggest(false);
  };

  // ── Save with new vendor check ───────────────────────────────────────────
  const handleSave = () => {
    if (!form.amount) return;

    // Check if paid_to is a new name (not in existing vendors)
    const paidToVal = form.paid_to.trim();
    if (paidToVal && !editId) {
      const isKnown = vendors.some(
        v => v.paid_to.toLowerCase() === paidToVal.toLowerCase()
      );
      if (!isKnown) {
        // Show confirmation popup for new vendor
        setConfirmVendor(paidToVal);
        return;
      }
    }
    doSave();
  };

const doSave = async () => {
  setConfirmVendor(null);
  setBusy(true);
  try {
    if (editId) await axios.put(`/api/cash-expenses/${editId}`, { ...form, project_id: projectId });
    else        await axios.post('/api/cash-expenses', { ...form, project_id: projectId });
    load(); loadVendors(); loadPending(); cancel();  // ← add loadPending()
  } catch(e) { console.error(e); }
  finally { setBusy(false); }
};

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
  const cancel = () => {
    setOpen(false); setEditId(null); setForm(BLANK);
    setSuggestions([]); setShowSuggest(false);
  };

  const del = async id => {
    if (!window.confirm('Delete this expense?')) return;
    await axios.delete(`/api/cash-expenses/${id}`);
    load();
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>

      {/* ── New Vendor Confirmation Popup ── */}
      {confirmVendor && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:28, maxWidth:380, width:'90%',
            boxShadow:'0 20px 60px rgba(0,0,0,0.4)'
          }}>
            <div style={{fontSize:20, marginBottom:8}}>👤 New Vendor / Worker</div>
            <div style={{fontSize:14, color:'var(--text-2)', marginBottom:20, lineHeight:1.6}}>
              <b style={{color:'var(--text)'}}>{confirmVendor}</b> is not in your vendor list yet.
              <br/>Do you want to add them and record this payment?
            </div>
            <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setConfirmVendor(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={doSave}
              >
                ✅ Yes, Add & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="cash-summary-grid">

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

      {/* ── Search ── */}
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <input
          placeholder="Search by name or amount"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', width:260, fontSize:13, maxWidth:'100%'}}
        />
      </div>  

      {/* ── Pending vendor bill payments notice ── */}
{pendingVendors.length > 0 && (
  <div style={{
    border: '1px solid #FDE68A',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#FFFBEB',
  }}>
    {/* Header row — always visible, click to toggle */}
    <div
      onClick={() => setShowPending(p => !p)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
          {pendingVendors.length} vendor{pendingVendors.length > 1 ? 's have' : ' has'} unpaid bills
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#D97706',
          borderRadius: 99, padding: '1px 8px', border: '1px solid #FDE68A',
        }}>
          {INR(pendingVendors.reduce((s, v) => s + v.due, 0))} total due
        </span>
      </div>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
        style={{ transform: showPending ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, pointerEvents: 'none' }}>
        <path d="M3 5l3.5 3.5L10 5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>

    {/* Expandable vendor list */}
    {showPending && (
      <div style={{ borderTop: '1px solid #FDE68A', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {pendingVendors.map(v => (
          <div key={v.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff', border: '1px solid #FDE68A', borderRadius: 8,
            padding: '8px 14px', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: '#FEF3C7',
                border: '1px solid #FDE68A', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#92400E', flexShrink: 0,
              }}>{v.name.trim()[0].toUpperCase()}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, fontSize: 12 }}>
              <span style={{ color: '#64748B' }}>
                Billed <b style={{ fontFamily: 'monospace', color: '#334155' }}>{INR(v.total)}</b>
              </span>
              <span style={{ color: '#64748B' }}>
                Paid <b style={{ fontFamily: 'monospace', color: '#059669' }}>{INR(v.paid)}</b>
              </span>
              <span style={{
                fontFamily: 'monospace', fontWeight: 800, color: '#DC2626',
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 6, padding: '2px 9px',
              }}>Due {INR(v.due)}</span>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#92400E', marginTop: 2, paddingLeft: 2 }}>
          💡 Add a Cash Out entry with "Paid To" = vendor name to record the payment
        </div>
      </div>
    )}
  </div>
)}

      {/* ── Expense table ── */}
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
                {filteredRows.length === 0 ? (
                  <tr className="tbl-empty"><td colSpan={8}>No expenses recorded yet. Click "Add Expense" to start.</td></tr>
                ) : filteredRows.map((r, i) => {
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

        {/* ── Add / Edit Form ── */}
        {open && (
          <div className="add-form" style={{display:'flex', flexDirection:'column', gap:14}}>

            <div className="cash-form-row3">
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

            <div className="cash-form-row2">
              <div className="form-col">
                <label className="form-lbl">Description</label>
                <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Cement 50 bags, Labour for foundation" />
              </div>

              {/* ── Paid To with autocomplete ── */}
              <div className="form-col" style={{position:'relative'}}>
                <label className="form-lbl">Paid To</label>
                <input
                  ref={paidToRef}
                  className="form-input"
                  value={form.paid_to}
                  onChange={e => handlePaidToChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                  onFocus={() => {
                    if (form.paid_to.trim() && suggestions.length > 0) setShowSuggest(true);
                  }}
                  placeholder="Vendor / Worker name"
                  autoComplete="off"
                />
                {/* Suggestions dropdown */}
                {showSuggest && suggestions.length > 0 && (
                  <div style={{
                    position:'absolute', top:'100%', left:0, right:0, zIndex:200,
                    background:'var(--surface)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius)', boxShadow:'0 8px 24px rgba(0,0,0,0.2)',
                    maxHeight:200, overflowY:'auto', marginTop:2,
                  }}>
                    {suggestions.map((v, i) => {
                      const cc = CAT_COLORS[v.category] || CAT_COLORS.Other;
                      return (
                        <div
                          key={i}
                          onMouseDown={() => pickSuggestion(v)}
                          style={{
                            padding:'9px 14px', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            borderBottom:'1px solid var(--border)',
                            transition:'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--primary)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >
                          <span style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{v.paid_to}</span>
                          {v.category && (
                            <span style={{
                              fontSize:10, fontWeight:700, background:cc.bg,
                              color:cc.text, borderRadius:99, padding:'2px 8px'
                            }}>
                              {v.category}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="form-col">
              <label className="form-lbl">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
            </div>

            <div className="form-actions">
              <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : editId ? 'Update' : 'Add Expense'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}