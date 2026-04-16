import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import axios from 'axios';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CATEGORIES = ['Materials', 'Labour', 'Subcontractor', 'Equipment', 'Transport', 'Other'];

const BLANK_BILL = {
  vendor_name: '',
  category: 'Labour',
  bill_amount: '',
  bill_date: new Date().toISOString().slice(0, 10),
  bill_reference: '',
};

const n = (v) => parseFloat(v) || 0;
const INR = (v) => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (d) => {
  if (!d) return '—';
  const s = String(d);
  let year, month, day;
  if (s.length > 10 && s.includes('T')) {
    // mysql2 Date object serialized as ISO — use LOCAL date methods, not UTC
    const dt = new Date(s);
    year  = dt.getFullYear();
    month = dt.getMonth() + 1;
    day   = dt.getDate();
  } else {
    // Plain "YYYY-MM-DD" from DATE_FORMAT — parse directly, zero timezone math
    [year, month, day] = s.slice(0, 10).split('-').map(Number);
  }
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
};

const CAT_CONFIG = {
  Materials:     { color: '#1D4ED8', light: '#EFF6FF', accent: '#3B82F6', text: '#1D4ED8', icon: '🧱' },
  Labour:        { color: '#92400E', light: '#FFFBEB', accent: '#F59E0B', text: '#92400E', icon: '👷' },
  Subcontractor: { color: '#5B21B6', light: '#F5F3FF', accent: '#8B5CF6', text: '#5B21B6', icon: '🔧' },
  Equipment:     { color: '#065F46', light: '#ECFDF5', accent: '#10B981', text: '#065F46', icon: '⚙️' },
  Transport:     { color: '#9A3412', light: '#FFF7ED', accent: '#F97316', text: '#9A3412', icon: '🚛' },
  Other:         { color: '#374151', light: '#F9FAFB', accent: '#6B7280', text: '#374151', icon: '📦' },
};

const STATUS_CONFIG = {
  paid:    { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981', label: 'Paid' },
  partial: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B', label: 'Partial' },
  unpaid:  { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444', label: 'Unpaid' },
};

/* ─── Style injection ───────────────────────────────────────────────────── */
const injectStyles = () => {
  if (document.getElementById('vbt-styles')) return;
  const el = document.createElement('style');
  el.id = 'vbt-styles';
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
    @keyframes vbt-spin   { to { transform: rotate(360deg); } }
    @keyframes vbt-fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
    .vbt-root * { box-sizing: border-box; }
    .vbt-vendor-row { transition: background 0.1s, border-left-color 0.1s; }
    .vbt-vendor-row:hover { background: #F8FAFC !important; }
    .vbt-icon-btn { transition: background 0.1s, border-color 0.1s; }
    .vbt-icon-btn:hover  { background: #F1F5F9 !important; border-color: #CBD5E1 !important; }
    .vbt-del-btn  { transition: background 0.1s, border-color 0.1s; }
    .vbt-del-btn:hover   { background: #FEF2F2 !important; border-color: #FECACA !important; }
    .vbt-add-bill { transition: background 0.1s, border-color 0.1s, color 0.1s; }
    .vbt-add-bill:hover  { background: #F1F5F9 !important; border-color: #94A3B8 !important; color: #1E293B !important; }
    .vbt-add-another { transition: background 0.1s, border-color 0.1s, color 0.1s; }
    .vbt-add-another:hover { border-color: #94A3B8 !important; color: #475569 !important; background: #F8FAFC !important; }
    .vbt-cat-item { transition: background 0.1s; }
    .vbt-cat-item:hover  { background: #F8FAFC !important; }
    .vbt-suggest-item { transition: background 0.1s; }
    .vbt-suggest-item:hover { background: #F1F5F9 !important; }
    .vbt-save-btn { transition: opacity 0.15s, transform 0.15s; }
    .vbt-save-btn:hover  { opacity: 0.9; transform: translateY(-1px); }
    .vbt-cancel-btn { transition: background 0.1s; }
    .vbt-cancel-btn:hover { background: #F1F5F9 !important; }
    .vbt-exp-btn { transition: background 0.15s, border-color 0.15s; }
    .vbt-bill-row { transition: box-shadow 0.1s; }
    .vbt-bill-row:hover  { box-shadow: 0 2px 10px rgba(0,0,0,0.07) !important; }
    .vbt-hdr-btn { transition: transform 0.15s; }
    .vbt-hdr-btn:hover   { transform: translateY(-1px) !important; }
  `;
  document.head.appendChild(el);
};

/* ─── Small reusable components ─────────────────────────────────────────── */
const CatBadge = memo(function CatBadge({ cat }) {
  const c = CAT_CONFIG[cat] || CAT_CONFIG.Other;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
      background:c.light, color:c.text, borderRadius:99, padding:'2px 9px',
      border:`1px solid ${c.accent}33`, whiteSpace:'nowrap',
    }}>
      <span style={{fontSize:10}}>{c.icon}</span>{cat}
    </span>
  );
});

const StatusPill = memo(function StatusPill({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700,
      background:s.bg, color:s.text, borderRadius:99, padding:'3px 9px',
      border:`1px solid ${s.border}`, whiteSpace:'nowrap',
    }}>
      <span style={{width:5,height:5,borderRadius:'50%',background:s.dot,flexShrink:0}}/>
      {s.label}
    </span>
  );
});

/* ─── Category Select ───────────────────────────────────────────────────── */
const CategorySelect = memo(function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = CAT_CONFIG[value] || CAT_CONFIG.Other;

  useEffect(() => {
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(p => !p)} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
        padding:'9px 12px', borderRadius:10, cursor:'pointer', userSelect:'none',
        border:`1.5px solid ${open ? cfg.accent : '#E2E8F0'}`,
        background: open ? cfg.light : '#FAFAFA',
        boxShadow: open ? `0 0 0 3px ${cfg.accent}1A` : 'none',
        transition:'border-color 0.15s, background 0.15s, box-shadow 0.15s',
      }}>
        <span style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:22,height:22,borderRadius:6,background:cfg.light,border:`1px solid ${cfg.accent}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>{cfg.icon}</span>
          <span style={{fontSize:13,fontWeight:600,color:cfg.color}}>{value}</span>
        </span>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0,pointerEvents:'none'}}>
          <path d="M3 5l3.5 3.5L10 5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 5px)',left:0,right:0,zIndex:500,background:'#fff',border:'1px solid #E2E8F0',borderRadius:12,boxShadow:'0 10px 36px rgba(0,0,0,0.13)',overflow:'hidden',animation:'vbt-fadeIn 0.13s ease'}}>
          {CATEGORIES.map(cat => {
            const c = CAT_CONFIG[cat]; const active = cat === value;
            return (
              <div key={cat} className="vbt-cat-item"
                onClick={() => { onChange(cat); setOpen(false); }}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',cursor:'pointer',borderBottom:'1px solid #F8FAFC',background:active?c.light:'transparent'}}>
                <span style={{width:22,height:22,borderRadius:6,background:c.light,border:`1px solid ${c.accent}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>{c.icon}</span>
                <span style={{flex:1,fontSize:13,fontWeight:active?600:400,color:active?c.color:'#374151'}}>{cat}</span>
                {active && <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{pointerEvents:'none'}}><path d="M2.5 6.5l3 3 5-5" stroke={c.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ─── Vendor Row (memoized — only re-renders when its own data changes) ─── */
const VendorRow = memo(function VendorRow({ vendor, isOpen, isLast, onToggle, onStartEdit, onStartAddBill, onDelBill, getEntries }) {
  const key          = vendor.name.toLowerCase().trim();
  const entries      = getEntries(vendor.name);
  const hasBills     = vendor.bills.length > 0;
  const totalBilledV = useMemo(() => {
    return (vendor.bills || []).reduce((s, b) => s + n(b.bill_amount), 0);
  }, [vendor.bills]);
  const vendorDue = Math.max(0, totalBilledV - n(vendor.total_paid));
  const catCfg       = CAT_CONFIG[vendor.category] || CAT_CONFIG.Other;

  /* Compute per-bill status: allocate payments oldest-first */
  const billCalc = useMemo(() => {
// 🔥 NEW → OLD (latest bill first)
const sortedBills = Array.isArray(vendor.bills)
  ? [...vendor.bills].sort((a, b) => {
      const da = String(a.bill_date).slice(0, 10);
      const db = String(b.bill_date).slice(0, 10);
      return da > db ? -1 : da < db ? 1 : 0;
    })
  : [];

// Payments in chronological order
const payments = Array.isArray(entries)
  ? [...entries].sort((a, b) => {
      const da = String(a.expense_date).slice(0, 10);
      const db = String(b.expense_date).slice(0, 10);
      return da < db ? -1 : da > db ? 1 : 0;
    })
  : [];
let paymentIndex = 0;
let remaining = payments[paymentIndex]?.amount || 0;

const calc = {};

sortedBills.forEach((bill) => {
let billAmt = n(bill.bill_amount);
let paid = 0;

while (billAmt > 0 && paymentIndex < payments.length) {
  if (remaining === 0) {
    paymentIndex++;
    remaining = payments[paymentIndex]?.amount || 0;
    continue;
  }

  const used = Math.min(remaining, billAmt);
  billAmt -= used;
  remaining -= used;
  paid += used;
}

const due = n(bill.bill_amount) - paid;

calc[bill.id] = {
  due,
  status:
    paid >= n(bill.bill_amount)
      ? 'paid'
      : paid > 0
      ? 'partial'
      : 'unpaid',
};

});

return calc;
}, [vendor.bills, entries]);


  console.log('Payments:', entries.map(e => ({
  date: e.expense_date,
  amount: e.amount
})));

console.log('Bills:', vendor.bills.map(b => ({
  date: b.bill_date,
  amount: b.bill_amount
})));

  const GRID = '44px 1fr 116px 116px 116px 120px 96px';

  return (
    <div style={{ borderBottom: isLast && !isOpen ? 'none' : '1px solid #F1F5F9' }}>

      {/* ── Data row ── */}
      <div className="vbt-vendor-row" style={{
        display:'grid', gridTemplateColumns:GRID, alignItems:'center', gap:12,
        padding:'13px 24px',
        background: isOpen ? `${catCfg.light}90` : '#fff',
        borderLeft: `3px solid ${isOpen ? catCfg.accent : 'transparent'}`,
      }}>
        {/* Avatar */}
        <div style={{width:40,height:40,borderRadius:12,flexShrink:0,background:`linear-gradient(135deg,${catCfg.light},${catCfg.accent}22)`,border:`1.5px solid ${catCfg.accent}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:catCfg.color}}>
          {vendor.name.trim()[0].toUpperCase()}
        </div>

        {/* Name + sub */}
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:'#0F172A',letterSpacing:'-0.01em',marginBottom:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{vendor.name}</div>
          <div style={{fontSize:11,color:'#94A3B8',display:'flex',alignItems:'center',gap:7}}>
            {vendor.entry_count} payment{vendor.entry_count!==1?'s':''} in Cash Out
            {!hasBills && <span style={{fontSize:10,fontWeight:600,background:'#F1F5F9',color:'#64748B',borderRadius:99,padding:'1px 7px',border:'1px solid #E2E8F0'}}>No bill</span>}
          </div>
        </div>

        {/* Category */}
        <div><CatBadge cat={vendor.category||'Other'}/></div>

        {/* Billed */}
        <div style={{textAlign:'right'}}>
            <span style={{fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'#2563EB',letterSpacing:'-0.01em'}}>{INR(totalBilledV)}</span>
            <span style={{fontSize:14,color:'#D1D5DB',fontWeight:400}}>—</span>
        </div>

        {/* Paid */}
        <div style={{textAlign:'right'}}>
          <span style={{fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'#059669',letterSpacing:'-0.01em'}}>{INR(n(vendor.total_paid))}</span>
        </div>

        {/* Due */}
        <div style={{textAlign:'right'}}>
            <span style={{fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'#DC2626',letterSpacing:'-0.01em'}}>{INR(vendorDue)}</span>
        </div>

        {/* Actions */}
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          {(
            <button className="vbt-add-bill" onClick={() => onStartAddBill(vendor)}
              style={{padding:'5px 11px',background:'transparent',border:'1.5px solid #E2E8F0',borderRadius:8,fontSize:12,fontWeight:600,color:'#475569',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
              + Bill
            </button>
          )}
          {/* Expand / collapse button */}
          <button
            className="vbt-exp-btn"
            onClick={() => onToggle(key)}
            style={{
              width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',
              border:`1.5px solid ${isOpen ? catCfg.accent : '#E2E8F0'}`,
              borderRadius:9,cursor:'pointer',flexShrink:0,
              background: isOpen ? catCfg.accent : '#FAFAFA',
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', pointerEvents: 'none' }}
            >
              <path d="M2 4.5l4 4 4-4" stroke={isOpen ? '#fff' : '#64748B'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {isOpen && (
        <div style={{background:'#F8FAFC',borderTop:'1px solid #EEF2F6',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20,animation:'vbt-fadeIn 0.15s ease'}}>

          {/* Bills section */}
          {hasBills && (
            <div>
              <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:'#94A3B8',marginBottom:10,display:'flex',alignItems:'center',gap:7}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{pointerEvents:'none'}}>
                  <rect x="1" y="1" width="10" height="10" rx="2" stroke="#CBD5E1" strokeWidth="1.2"/>
                  <path d="M3.5 4.5h5M3.5 7h3" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Bills ({vendor.bills.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {vendor.bills.map(bill => {
                  const { due, status } = billCalc[bill.id] || { due: n(bill.bill_amount), status: 'unpaid' };
                  return (
                    <div key={bill.id} className="vbt-bill-row" style={{display:'flex',alignItems:'center',gap:14,background:'#fff',border:'1px solid #E8ECF0',borderRadius:12,padding:'12px 16px',borderLeft:`3px solid ${STATUS_CONFIG[status].dot}`}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:4}}>
                          <span style={{fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'#0F172A',letterSpacing:'-0.02em'}}>{INR(bill.bill_amount)}</span>
                          <StatusPill status={status}/>
                        </div>
                        <div style={{fontSize:11,color:'#94A3B8'}}>
                          📅 {fmtDate(bill.bill_date)}
                          {bill.bill_reference && <span style={{marginLeft:10}}>· Ref: {bill.bill_reference}</span>}
                        </div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:due>0?'#DC2626':'#059669',background:due>0?'#FEF2F2':'#ECFDF5',border:`1px solid ${due>0?'#FECACA':'#A7F3D0'}`,borderRadius:8,padding:'4px 10px',whiteSpace:'nowrap'}}>
                        {due > 0 ? `Due: ${INR(due)}` : '✓ Fully Paid'}
                      </div>
                      <button className="vbt-icon-btn" title="Edit" onClick={() => onStartEdit(bill, vendor.name, vendor.category)}
                        style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #E2E8F0',borderRadius:8,background:'transparent',cursor:'pointer',flexShrink:0}}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{pointerEvents:'none'}}>
                          <path d="M8.5 1.5l2 2-6 6H3V8l5.5-6.5z" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button className="vbt-del-btn" title="Delete" onClick={() => onDelBill(bill.id)}
                        style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #E2E8F0',borderRadius:8,background:'transparent',cursor:'pointer',flexShrink:0}}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{pointerEvents:'none'}}>
                          <path d="M2 3.5h8M5 3.5V2h2v1.5M9.5 3.5l-.5 6H3l-.5-6" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="vbt-add-another" onClick={() => onStartAddBill(vendor)}
                style={{display:'flex',alignItems:'center',gap:6,marginTop:8,padding:'7px 13px',border:'1.5px dashed #CBD5E1',borderRadius:9,background:'transparent',color:'#94A3B8',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{pointerEvents:'none'}}>
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Add Another Bill
              </button>
            </div>
          )}

          {/* Cash Out history */}
          <div>
            <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:'#94A3B8',marginBottom:10,display:'flex',alignItems:'center',gap:7}}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{pointerEvents:'none'}}>
                <circle cx="6" cy="6" r="4.5" stroke="#CBD5E1" strokeWidth="1.2"/>
                <path d="M6 3.5V6l1.5 1.5" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Cash Out History ({entries.length})
            </div>
            {entries.length === 0 ? (
              <div style={{background:'#fff',border:'1px dashed #E2E8F0',borderRadius:12,padding:'18px',fontSize:13,color:'#94A3B8',textAlign:'center'}}>
                No payments yet. Add via <b style={{color:'#475569'}}>Cash Out</b> with Paid To = <b style={{color:catCfg.color}}>{vendor.name}</b>
              </div>
            ) : (
              <div style={{background:'#fff',border:'1px solid #E8ECF0',borderRadius:12,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FAFBFC'}}>
                      {['#','Date','Category','Description','Amount','Notes'].map((h,i)=>(
                        <th key={h} style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#94A3B8',padding:'9px 14px',textAlign:i===4?'right':'left',borderBottom:'1px solid #F1F5F9',fontFamily:'inherit',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e.id} style={{borderBottom:i<entries.length-1?'1px solid #F8FAFC':'none'}}>
                        <td style={{padding:'9px 14px',color:'#CBD5E1',fontSize:11}}>{i+1}</td>
                        <td style={{padding:'9px 14px',fontSize:12,fontWeight:600,color:'#475569',whiteSpace:'nowrap'}}>{fmtDate(e.expense_date)}</td>
                        <td style={{padding:'9px 14px'}}><CatBadge cat={e.category}/></td>
                        <td style={{padding:'9px 14px',color:'#64748B',maxWidth:200}}>{e.description||'—'}</td>
                        <td style={{padding:'9px 14px',textAlign:'right',color:'#DC2626',fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{INR(e.amount)}</td>
                        <td style={{padding:'9px 14px',color:'#94A3B8'}}>{e.notes||'—'}</td>
                      </tr>
                    ))}
                    <tr style={{background:'#F8FAFC',borderTop:'1.5px solid #E8ECF0'}}>
                      <td colSpan={4} style={{padding:'9px 14px',textAlign:'right',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#94A3B8'}}>Total Paid</td>
                      <td style={{padding:'9px 14px',textAlign:'right',color:'#059669',fontWeight:800,fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{INR(n(vendor.total_paid))}</td>
                      <td style={{padding:'9px 14px'}}/>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function VendorBillsTab({ projectId }) {
  const [summary,     setSummary]     = useState({ payments:[], bills:[], entries:[] });
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState({});
  const [openForm,    setOpenForm]    = useState(false);
  const [form,        setForm]        = useState(BLANK_BILL);
  const [editId,      setEditId]      = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => { injectStyles(); }, []);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`/api/vendor-bills/summary/${projectId}`)
      .then(r => setSummary(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const setF = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);

  /* ── Build vendor map (memoized — only recomputes when summary changes) ── */
  const { vendorMap, vendors, totalBilled, totalPaidAll, totalLiability } = useMemo(() => {
    const vMap = {};

    summary.payments.forEach(p => {
    const key = (p.paid_to || '').toLowerCase().trim();

    if (!vMap[key]) {
      vMap[key] = {
        name: p.paid_to || '',
        category: p.category || 'Other',
        total_paid: 0,
        entry_count: 0,
        bills: []
      };
    }

    vMap[key].total_paid += n(p.total_paid);
    vMap[key].entry_count += parseInt(p.entry_count) || 0;
    });

  summary.bills.forEach(b => {
    const key = (b.vendor_name || '').toLowerCase().trim();

    if (!vMap[key]) {
      vMap[key] = {
        name: b.vendor_name || '',
        category: b.category || 'Other',
        total_paid: 0,
        entry_count: 0,
        bills: []
      };
    }

    vMap[key].bills.push({
      ...b,
      bill_amount: n(b.bill_amount) // ✅ force number
    });
  });

    const vList = Object.values(vMap).sort((a, b) => a.name.localeCompare(b.name));

    const tBilled  = summary.bills.reduce((s, b) => s + n(b.bill_amount), 0);
    const tPaid    = vList.reduce((s, v) => s + v.total_paid, 0);
    // Liability = same formula as Due column: total billed − total paid per vendor
    const tLiab    = vList.reduce((sum, v) => {
      const vBilled = v.bills.reduce((s, b) => s + n(b.bill_amount), 0);
      return sum + Math.max(0, vBilled - v.total_paid);
    }, 0);

    return { vendorMap: vMap, vendors: vList, totalBilled: tBilled, totalPaidAll: tPaid, totalLiability: tLiab };
  }, [summary]);

  /* ── Entry lookup (memoized) ── */
  const entriesByVendor = useMemo(() => {
    const map = {};
    summary.entries.forEach(e => {
      const key = (e.paid_to || '').toLowerCase().trim();
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [summary.entries]);

  const getEntries = useCallback((name) => {
    return entriesByVendor[name.toLowerCase().trim()] || [];
  }, [entriesByVendor]);

  /* ── Stable callbacks (never recreated) ── */
  const toggleExpand = useCallback((key) => {
    setExpanded(p => ({ ...p, [key]: !p[key] }));
  }, []);

  /* ── Autocomplete ── */
  const handleNameChange = useCallback((val) => {
    setF('vendor_name', val);
    if (!val.trim()) { setSuggestions([]); setShowSuggest(false); return; }
    const f = Object.values(vendorMap).filter(v => v.name.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(f); setShowSuggest(f.length > 0);
  }, [vendorMap, setF]);

  const pickSuggestion = useCallback((v) => {
    setF('vendor_name', v.name);
    if (v.category && CATEGORIES.includes(v.category)) setF('category', v.category);
    setSuggestions([]); setShowSuggest(false);
  }, [setF]);

  /* ── CRUD ── */
  const save = useCallback(async () => {
    if (!form.vendor_name.trim() || !form.bill_amount || !form.bill_date) return;
    setBusy(true);
    try {
      if (editId) await axios.put(`/api/vendor-bills/${editId}`, { ...form });
      else        await axios.post('/api/vendor-bills', { ...form, project_id: projectId });
      load(); cancelForm();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  }, [form, editId, projectId, load]);

  const startEdit = useCallback((bill, vName, vCat) => {
    setEditId(bill.id);
    setForm({ vendor_name: bill.vendor_name||vName, category: bill.category||vCat||'Labour',
              bill_amount: bill.bill_amount||'', bill_date: (bill.bill_date||'').slice(0,10),
              bill_reference: bill.bill_reference||'' });
    setOpenForm(true);
  }, []);

  const startAddBill = useCallback((vendor) => {
    setEditId(null);
    setForm({ ...BLANK_BILL, vendor_name: vendor.name, category: vendor.category||'Labour' });
    setOpenForm(true);
  }, []);

  const cancelForm = useCallback(() => {
    setOpenForm(false); setEditId(null); setForm(BLANK_BILL);
    setSuggestions([]); setShowSuggest(false);
  }, []);

  const delBill = useCallback(async (id) => {
    if (!window.confirm('Delete this vendor bill?')) return;
    await axios.delete(`/api/vendor-bills/${id}`); load();
  }, [load]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80,gap:12}}>
      <div style={{width:28,height:28,border:'3px solid #E2E8F0',borderTopColor:'#3B82F6',borderRadius:'50%',animation:'vbt-spin 0.7s linear infinite'}}/>
      <style>{`@keyframes vbt-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── Shared input style ── */
  const inputBase = {
    width:'100%', padding:'10px 13px', border:'1.5px solid #E2E8F0', borderRadius:10,
    background:'#FAFAFA', color:'#0F172A', fontSize:13, outline:'none',
    fontFamily:"'Plus Jakarta Sans', sans-serif",
    transition:'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  };
  const onFocus = (e) => { e.target.style.borderColor='#3B82F6'; e.target.style.boxShadow='0 0 0 3px #3B82F618'; e.target.style.background='#fff'; };
  const onBlur  = (e) => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none'; e.target.style.background='#FAFAFA'; };

  const GRID = '44px 1fr 116px 116px 116px 120px 96px';

  return (
    <div className="vbt-root" style={{ fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", display:'flex', flexDirection:'column', gap:18 }}>

      {/* ══════════ Summary header ══════════ */}
      <div style={{background:'linear-gradient(130deg,#0F172A 0%,#1E3A5F 55%,#1E293B 100%)',borderRadius:18,padding:'24px 28px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(59,130,246,0.07)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-20,right:140,width:90,height:90,borderRadius:'50%',background:'rgba(99,102,241,0.06)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#3B82F6'}}/>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#64748B'}}>Vendor & Bill Overview</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {[
            { label:'Total Paid',    value:INR(totalPaidAll),   icon:'✅',  color:'#34D399', sub:`across ${vendors.length} vendor${vendors.length!==1?'s':''}` },
            { label:'Total Billed',  value:INR(totalBilled),    icon:'🧾', color:'#60A5FA', sub:`${summary.bills.length} bill${summary.bills.length!==1?'s':''}` },
            { label:'Liability Due', value:INR(totalLiability), icon:totalLiability>0?'⚠️':'✓', color:totalLiability>0?'#FCA5A5':'#34D399', sub:totalLiability>0?'Outstanding amount':'All clear' },
          ].map(({ label, value, icon, color, sub }) => (
            <div key={label} style={{background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'18px 20px',border:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:10,fontWeight:700,color:'#475569',letterSpacing:'0.06em',textTransform:'uppercase'}}>{label}</span>
                <span style={{fontSize:16}}>{icon}</span>
              </div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color,letterSpacing:'-0.03em',lineHeight:1,marginBottom:6}}>{value}</div>
              <div style={{fontSize:11,color:'#334155',fontWeight:500}}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ Vendor table ══════════ */}
      <div style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:18,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,0.04)'}}>

        {/* Card header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid #F1F5F9',background:'#FAFBFC'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#1E293B,#334155)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>👥</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#0F172A',letterSpacing:'-0.01em'}}>Vendors & Workers</div>
              <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{vendors.length} vendor{vendors.length!==1?'s':''} found</div>
            </div>
          </div>
          <button className="vbt-hdr-btn" onClick={() => { cancelForm(); setOpenForm(true); }}
            style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',background:'linear-gradient(135deg,#0F172A,#1E293B)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 2px 8px rgba(15,23,42,0.22)',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{pointerEvents:'none'}}>
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Vendor Bill
          </button>
        </div>

        {/* Column headers */}
        {vendors.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:GRID,alignItems:'center',gap:12,padding:'9px 24px',background:'#F4F6F8',borderBottom:'1px solid #E8ECF0'}}>
            {[
              {label:'',align:'left'},{label:'Vendor',align:'left'},{label:'Category',align:'left'},
              {label:'Billed',align:'right'},{label:'Paid',align:'right'},{label:'Due',align:'right'},{label:'',align:'right'},
            ].map((col, i) => (
              <div key={i} style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.07em',color:'#A0AEC0',textAlign:col.align}}>{col.label}</div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {vendors.length === 0 && (
          <div style={{padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:44,marginBottom:14}}>👥</div>
            <div style={{fontSize:15,fontWeight:700,color:'#374151',marginBottom:6}}>No vendors yet</div>
            <div style={{fontSize:13,color:'#94A3B8',maxWidth:280,margin:'0 auto',lineHeight:1.6}}>
              Add expenses with a "Paid To" name in Cash Out — they'll appear here automatically.
            </div>
          </div>
        )}

        {/* Vendor rows — each is a memoized component */}
        {vendors.map((vendor, idx) => (
          <VendorRow
            key={vendor.name.toLowerCase().trim()}
            vendor={vendor}
            isOpen={!!expanded[vendor.name.toLowerCase().trim()]}
            isLast={idx === vendors.length - 1}
            onToggle={toggleExpand}
            onStartEdit={startEdit}
            onStartAddBill={startAddBill}
            onDelBill={delBill}
            getEntries={getEntries}
          />
        ))}

        {/* ══════════ Add / Edit form ══════════ */}
        {openForm && (
          <div style={{borderTop:'1px solid #E2E8F0',padding:'22px 24px',background:'linear-gradient(180deg,#FAFBFC,#fff)',display:'flex',flexDirection:'column',gap:16,animation:'vbt-fadeIn 0.18s ease'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:34,height:34,borderRadius:10,background:editId?'#FEF3C7':'#DBEAFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
                {editId?'✏️':'➕'}
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'#0F172A'}}>{editId?'Edit Vendor Bill':'Add Vendor Bill'}</div>
                <div style={{fontSize:11,color:'#94A3B8',marginTop:1}}>{editId?'Update bill details below':'Fill in the details to record a new bill'}</div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{display:'flex',flexDirection:'column',gap:6,position:'relative'}}>
                <label style={{fontSize:11,fontWeight:700,color:'#475569',letterSpacing:'0.03em',textTransform:'uppercase'}}>
                  Vendor / Worker Name <span style={{color:'#EF4444'}}>*</span>
                </label>
                <input style={inputBase} value={form.vendor_name}
                  onChange={e=>handleNameChange(e.target.value)}
                  onBlur={()=>setTimeout(()=>setShowSuggest(false),160)}
                  onFocus={onFocus} placeholder="e.g. Paresh Bhai" autoComplete="off"/>
                {showSuggest && suggestions.length > 0 && (
                  <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:500,background:'#fff',border:'1px solid #E2E8F0',borderRadius:12,boxShadow:'0 10px 36px rgba(0,0,0,0.13)',overflow:'hidden',animation:'vbt-fadeIn 0.12s ease'}}>
                    {suggestions.map((v,i)=>(
                      <div key={i} className="vbt-suggest-item"
                        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #F8FAFC',fontSize:13,color:'#1E293B'}}
                        onMouseDown={()=>pickSuggestion(v)}>
                        <span style={{fontWeight:500}}>{v.name}</span>
                        {v.category && <CatBadge cat={v.category}/>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:11,fontWeight:700,color:'#475569',letterSpacing:'0.03em',textTransform:'uppercase'}}>Category</label>
                <CategorySelect value={form.category} onChange={val=>setF('category',val)}/>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
              {[
                {label:'Bill Amount (₹)',key:'bill_amount',type:'number',ph:'0.00',req:true},
                {label:'Bill Date',key:'bill_date',type:'date',ph:'',req:true},
                {label:'Reference',key:'bill_reference',type:'text',ph:'Invoice no.',opt:true},
              ].map(({label,key,type,ph,req,opt})=>(
                <div key={key} style={{display:'flex',flexDirection:'column',gap:6}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#475569',letterSpacing:'0.03em',textTransform:'uppercase'}}>
                    {label} {req&&<span style={{color:'#EF4444'}}>*</span>}
                    {opt&&<span style={{color:'#94A3B8',fontWeight:400,textTransform:'none',fontSize:10}}> (optional)</span>}
                  </label>
                  <input style={inputBase} type={type} min={type==='number'?'0':undefined}
                    value={form[key]} onChange={e=>setF(key,e.target.value)}
                    onFocus={onFocus} onBlur={onBlur} placeholder={ph}/>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:6,borderTop:'1px solid #F1F5F9',marginTop:2}}>
              <button className="vbt-cancel-btn" onClick={cancelForm}
                style={{padding:'9px 20px',border:'1.5px solid #E2E8F0',borderRadius:10,background:'transparent',color:'#64748B',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                Cancel
              </button>
              <button className="vbt-save-btn" onClick={save} disabled={busy}
                style={{padding:'9px 24px',border:'none',borderRadius:10,background:busy?'#94A3B8':'linear-gradient(135deg,#0F172A,#1E293B)',color:'#fff',fontSize:13,fontWeight:700,cursor:busy?'not-allowed':'pointer',boxShadow:busy?'none':'0 2px 8px rgba(15,23,42,0.22)',fontFamily:'inherit'}}>
                {busy?'Saving…':editId?'✓ Update Bill':'+ Add Bill'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}