import { useState, useEffect } from 'react';
import axios from 'axios';

const INR = v => '₹' + parseFloat(v||0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const f   = n => parseFloat(n||0);

const STATUS_COLORS = {
  active:    { bg:'#DCFCE7', text:'#16A34A', dot:'#16A34A' },
  on_hold:   { bg:'#FEF9C3', text:'#D97706', dot:'#D97706' },
  completed: { bg:'#EDE9FE', text:'#7C3AED', dot:'#7C3AED' },
};
const STATUS_LABELS = { active:'Active', on_hold:'On Hold', completed:'Completed' };

export default function HomePage({ currentUser, asUser = 'all' }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tip,     setTip]     = useState(null); // ✅ was missing — caused crash on profit click

  useEffect(() => {
    setLoading(true);
    // ✅ Pass asUser param so dashboard API actually filters
    const params = (currentUser?.role === 'admin' && asUser !== 'all')
      ? `?as_user=${asUser}`
      : '';
    axios.get(`/api/dashboard${params}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [asUser]); // ✅ re-fetch when admin switches user view

  if (loading) return <div className="loader" style={{flex:1}}><div className="spinner"/></div>;
  if (!data)   return <div className="welcome"><p>Could not load dashboard.</p></div>;

  const { status_counts, financials, projects } = data;

  return (
    <div style={{padding:'60px 28px 28px', display:'flex', flexDirection:'column', gap:24}}>

      {/* Page title */}
      <div>
        <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--text-3)', marginBottom:4}}>Overview</div>
        <div style={{fontSize:28, fontWeight:800, color:'var(--text)'}}>Dashboard</div>
        <div style={{fontSize:13, color:'var(--text-3)', marginTop:3}}>Active, On Hold & Completed projects summary</div>
      </div>

      {/* Status count cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14}}>
        {[
          { label:'Total Projects', val:status_counts.total,     color:'var(--primary)' },
          { label:'Active',         val:status_counts.active,    color:'var(--success)' },
          { label:'On Hold',        val:status_counts.on_hold,   color:'var(--warn)'    },
          { label:'Completed',      val:status_counts.completed, color:'#7C3AED'        },
        ].map(c => (
          <div key={c.label} style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)'}}>
            <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.7, color:'var(--text-3)', marginBottom:8}}>{c.label}</div>
            <div style={{fontSize:32, fontWeight:800, color:c.color}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Financial summary cards */}
      <div>
        <div style={{fontSize:13, fontWeight:700, color:'var(--text-2)', marginBottom:12, textTransform:'uppercase', letterSpacing:0.8}}>Financial Summary</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14}}>
          {[
            { label:'Total Estimated',   val:INR(financials.total_billed),   color:'var(--accent)',  icon:'🧾' },
            { label:'Cash In (Received)',val:INR(financials.total_cash_in),  color:'var(--success)', icon:'💰' },
            { label:'Cash Out (Expense)',val:INR(financials.total_cash_out), color:'var(--danger)',  icon:'💸' },
            { label:'Balance Due',       val:INR(financials.total_balance),  color:'#D97706',        icon:'⏳' },
            { label:'Net Profit',        val:INR(financials.total_profit),   color:'#7C3AED',        icon:'📈' },
            { label:'Liability (Vendor Due)', val:INR(financials.total_liability ?? 0), color:'#DC2626', icon:'⚠️' },
          ].map(c => (
            <div key={c.label} style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px', boxShadow:'var(--shadow-sm)', position:'relative', overflow:'hidden'}}>
              <div style={{fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:0.7, color:'var(--text-3)', marginBottom:6}}>{c.label}</div>
              <div style={{fontSize:17, fontWeight:800, fontFamily:'var(--font-mono)', color:c.color, letterSpacing:-0.5}}>{c.val}</div>
              <div style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:26, opacity:0.07}}>{c.icon}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 Real Estate Project Table</div>
        </div>
        {projects.length === 0 ? (
          <div className="tbl-empty" style={{padding:48, textAlign:'center', color:'var(--text-3)'}}>
            No active, on-hold, or completed projects yet.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th className="right">Total Bill</th>
                  <th className="right" style={{color:'var(--success)'}}>Cash In</th>
                  <th className="right" style={{color:'var(--danger)'}}>Cash Out</th>
                  <th className="right">Balance Due</th>
                  <th className="right" style={{color:'#7C3AED'}}>Profit (Current)</th>
                  <th className="right" style={{color:'#0EA5E9'}}>Expected Profit</th>
                  <th className="right" style={{color:'#DC2626'}}>Liability</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => {
                  const sc = STATUS_COLORS[p.status] || STATUS_COLORS.active;
                  return (
                    <tr key={p.id}>
                      <td className="muted" style={{fontSize:11}}>{i+1}</td>
                      <td className="strong">{p.project_name}</td>
                      <td className="muted">{p.client_name}</td>
                      <td>
                        <span style={{display:'inline-flex', alignItems:'center', gap:5, background:sc.bg, color:sc.text, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:600}}>
                          <span style={{width:6, height:6, borderRadius:'50%', background:sc.dot, flexShrink:0}}/>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </td>
                      <td className="right" style={{color:'var(--accent)', fontWeight:700, fontFamily:'var(--font-mono)'}}>{INR(p.total_bill)}</td>
                      <td className="right" style={{color:'var(--success)', fontFamily:'var(--font-mono)', fontWeight:600}}>{INR(p.cash_in)}</td>
                      <td className="right" style={{color:f(p.cash_out)>0?'var(--danger)':'var(--text-3)', fontFamily:'var(--font-mono)', fontWeight:600}}>{INR(p.cash_out)}</td>
                      <td className="right" style={{color:f(p.balance_due)>0?'#D97706':'var(--success)', fontFamily:'var(--font-mono)', fontWeight:700}}>
                        {f(p.balance_due)>0 ? INR(p.balance_due) : '✓ Paid'}
                      </td>

                      {/* ✅ tip state now declared above */}
                      <td className="right" style={{color:f(p.profit_current)>=0?'#7C3AED':'var(--danger)', fontFamily:'var(--font-mono)', fontWeight:700}}>
                        <span
                          onClick={() => setTip(tip?.id===p.id && tip?.type==='current' ? null : {id:p.id, type:'current'})}
                          style={{cursor:'pointer', borderBottom:'1px dashed currentColor'}}
                        >
                          {INR(p.profit_current)}
                        </span>
                        {tip?.id===p.id && tip?.type==='current' && (
                          <div style={{marginTop:6,background:'#F3E8FF',border:'1px solid #DDD6FE',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#4C1D95',textAlign:'left',fontFamily:'var(--font)',fontWeight:400,whiteSpace:'nowrap',position:'relative',zIndex:10}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                              <span style={{fontWeight:700,fontSize:11}}>💼 Profit (Current)</span>
                              <span onClick={()=>setTip(null)} style={{cursor:'pointer',color:'#7C3AED',fontWeight:700,fontSize:13,marginLeft:12}}>✕</span>
                            </div>
                            <div>Cash In: <b>{INR(p.cash_in)}</b></div>
                            <div>Cash Out: <b>− {INR(p.cash_out)}</b></div>
                            <div style={{borderTop:'1px solid #DDD6FE',marginTop:4,paddingTop:4,fontWeight:700}}>= {INR(p.profit_current)}</div>
                          </div>
                        )}
                      </td>

                      <td className="right" style={{color:'#0EA5E9', fontFamily:'var(--font-mono)', fontWeight:600}}>
                        <span
                          onClick={() => setTip(tip?.id===p.id && tip?.type==='expected' ? null : {id:p.id, type:'expected'})}
                          style={{cursor:'pointer', borderBottom:'1px dashed currentColor'}}
                        >
                          {INR(p.profit_expected)}
                        </span>
                        {tip?.id===p.id && tip?.type==='expected' && (
                          <div style={{marginTop:6,background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#1E3A5F',textAlign:'left',fontFamily:'var(--font)',fontWeight:400,whiteSpace:'nowrap',position:'relative',zIndex:10}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                              <span style={{fontWeight:700,fontSize:11}}>📈 Expected Profit</span>
                              <span onClick={()=>setTip(null)} style={{cursor:'pointer',color:'#2563EB',fontWeight:700,fontSize:13,marginLeft:12}}>✕</span>
                            </div>
                            <div>Total Bill: <b>{INR(p.total_bill)}</b></div>
                            <div>Cash Out: <b>− {INR(p.cash_out)}</b></div>
                            <div style={{borderTop:'1px solid #BFDBFE',marginTop:4,paddingTop:4,fontWeight:700}}>= {INR(p.profit_expected)}</div>
                          </div>
                        )}
                      </td>
                      <td className="right" style={{color: f(p.liability)>0 ? '#DC2626' : 'var(--text-3)', fontFamily:'var(--font-mono)', fontWeight:600}}>
                        {f(p.liability) > 0 ? INR(p.liability) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:'var(--primary)'}}>
                  <td colSpan={4} style={{color:'#94A3B8', fontSize:11, fontWeight:600, padding:'12px 14px', textAlign:'right', letterSpacing:1}}>TOTALS</td>
                  <td className="right" style={{color:'var(--accent)', fontWeight:700, fontFamily:'var(--font-mono)', padding:'12px 14px'}}>{INR(financials.total_billed)}</td>
                  <td className="right" style={{color:'var(--success)', fontFamily:'var(--font-mono)', padding:'12px 14px', fontWeight:700}}>{INR(financials.total_cash_in)}</td>
                  <td className="right" style={{color:f(financials.total_cash_out)>0?'var(--danger)':'var(--text-3)', fontFamily:'var(--font-mono)', padding:'12px 14px', fontWeight:700}}>{INR(financials.total_cash_out)}</td>
                  <td className="right" style={{color:'#D97706', fontFamily:'var(--font-mono)', padding:'12px 14px', fontWeight:700}}>{INR(financials.total_balance)}</td>
                  <td className="right" style={{color:'#C4B5FD', fontFamily:'var(--font-mono)', padding:'12px 14px', fontWeight:700}}>{INR(financials.total_profit)}</td>
                  <td className="right" style={{color:'#FCA5A5', fontFamily:'var(--font-mono)', padding:'12px 14px', fontWeight:700}}>{INR(financials.total_liability)}</td>
                  <td style={{padding:'12px 14px'}}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}