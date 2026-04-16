import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ProjectModal from './ProjectModal.jsx';
import WorkTable    from './WorkTable.jsx';
import PaymentsTab  from './PaymentsTab.jsx';
import InvoiceTab   from './InvoiceTab.jsx';
import VendorBillsTab from './VendorBillsTab.jsx';
import QuotationTab     from './QuotationTab.jsx';
import CashExpenseTab  from './CashExpenseTab.jsx';

const n   = v => parseFloat(v) || 0;
const INR = v => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const STATUS_CLS = {
  planning:'badge-planning', active:'badge-active', on_hold:'badge-on_hold',
  completed:'badge-completed', cancelled:'badge-cancelled',
};

const TABS = [
  { key:'architect',    label:'Actual Unit Invoice', icon:'📐' },
  { key:'contractor',   label:'Fix Unit Invoice',    icon:'📊' },
  { key:'payments',     label:'Cash In',             icon:'💰' },
  { key:'cashout',      label:'Cash Out',            icon:'💸' },
  { key:'vendorbills',  label:'Vendor Bills',        icon:'📋' },  // ← ADD
  { key:'invoice',      label:'Invoice & PDF',       icon:'📄' },
  { key:'quotation',    label:'Quotation',           icon:'📋' },
];

export default function ProjectView({ client, onEditClient, onClientDeleted, toast, asUser, pdfUrl = u => u }) {
  const [project,    setProject]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('architect');
  const [showProjMd, setShowProjMd] = useState(false);
  const [rev,        setRev]        = useState(0);

  const loadProject = useCallback(() => {
    setLoading(true);
    axios.get(`/api/projects/client/${client.id}`)
      .then(async r => {
        if (r.data.length > 0) {
          const full = await axios.get(`/api/projects/${r.data[0].id}`);
          setProject(full.data);
        } else {
          setProject(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [client.id]);

  useEffect(() => { loadProject(); setActiveTab('architect'); }, [client.id]);
  useEffect(() => { if (rev > 0) loadProject(); }, [rev]);

  const refresh = () => setRev(r => r + 1);

  const handleDeleteClient = async () => {
    if (!window.confirm(`Delete "${client.client_name}" and ALL data? Cannot be undone.`)) return;
    try {
      await axios.delete(`/api/clients/${client.id}`);
      toast('Client deleted');
      onClientDeleted();
    } catch (e) { toast('Delete failed', 'error'); }
  };

  if (loading) return <div className="loader" style={{flex:1}}><div className="spinner" /></div>;

  const archTotal = n(project?.architect_total);
  const contTotal = n(project?.contractor_total);
  const totalBill = n(project?.total_bill);
  const totalPaid = n(project?.total_paid);
  const balance   = n(project?.balance_due);

  return (
    <div className="project-view">
      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="breadcrumb">Clients › <b>{client.client_name}</b></div>
          <div className="proj-title">{project ? project.project_name : client.client_name}</div>
          {project && (
            <div className="proj-meta">
              <span className={`badge ${STATUS_CLS[project.status]||'badge-planning'}`}>
                {project.status?.replace('_',' ')}
              </span>
              {project.location && <span className="proj-meta-item">📍 {project.location}</span>}
              {project.start_date && (
                <span className="proj-meta-item">📅 {new Date(project.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
              )}
              {project.invoice_number && (
                <span className="proj-meta-item" style={{color:'var(--accent)',fontWeight:600}}>🔢 {project.invoice_number}</span>
              )}
            </div>
          )}
        </div>
        <div className="top-bar-actions">
          <button className="btn btn-outline btn-sm" onClick={() => onEditClient(client)}>✏️ Client</button>
          {project
            ? <button className="btn btn-outline btn-sm" onClick={() => setShowProjMd(true)}>✏️ Project</button>
            : <button className="btn btn-primary btn-sm" onClick={() => setShowProjMd(true)}>＋ New Project</button>
          }
          <button className="btn btn-danger btn-sm" onClick={handleDeleteClient}>🗑️</button>
        </div>
      </div>

      {!project ? (
        <div className="card" style={{textAlign:'center',padding:56}}>
          <div style={{fontSize:44,marginBottom:12}}>📋</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--text-2)',marginBottom:8}}>No Project Yet</div>
          <p style={{color:'var(--text-3)',marginBottom:20,fontSize:13}}>Create a project for {client.client_name} to start tracking work and payments.</p>
          <button className="btn btn-primary" onClick={() => setShowProjMd(true)}>＋ Create Project</button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="summary-row">
            <div className="sum-card bill">
              <div className="sum-label">Total Bill</div>
              <div className="sum-val">{INR(totalBill)}</div>
              {/* ✅ Updated labels */}
              <div className="sum-sub">Actual Unit {INR(archTotal)} + Fix Unit {INR(contTotal)}</div>
              <div className="sum-icon">🧾</div>
            </div>
            <div className="sum-card paid">
              <div className="sum-label">Total Paid</div>
              <div className="sum-val">{INR(totalPaid)}</div>
              <div className="sum-sub">Advance &amp; instalments received</div>
              <div className="sum-icon">✅</div>
            </div>
            <div className={`sum-card balance ${balance<=0?'zero':''}`}>
              <div className="sum-label">{balance>0?'Balance Due':'Status'}</div>
              <div className="sum-val">{balance>0?INR(balance):'PAID ✓'}</div>
              <div className="sum-sub">{balance>0?'Client still has to pay':'No balance outstanding'}</div>
              <div className="sum-icon">{balance>0?'⚠️':'✅'}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.key} className={`tab-btn ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'architect' && (
            <WorkTable key={`arch-${project.id}`} projectId={project.id} apiPath="architect-work"
              title="Actual Unit Invoice — Architect Work" color="var(--blue)" />
          )}
          {activeTab === 'contractor' && (
            <WorkTable key={`cont-${project.id}`} projectId={project.id} apiPath="contractor-work"
              title="Fix Unit Invoice — Site / Execution" color="var(--accent)" />
          )}
          {activeTab === 'payments' && (
            <PaymentsTab key={`pay-${project.id}`} projectId={project.id}
              archTotal={archTotal} contTotal={contTotal} onChanged={refresh} />
          )}
          {activeTab === 'invoice' && (
            <InvoiceTab key={`inv-${project.id}`} project={project}
            archTotal={archTotal} contTotal={contTotal} onProjectUpdated={refresh} pdfUrl={pdfUrl} />
          )}
          {activeTab === 'quotation' && (
            <QuotationTab key={`quo-${project.id}`} project={project} pdfUrl={pdfUrl} />
          )}
          {activeTab === 'cashout' && (
            <CashExpenseTab key={`cash-${project.id}`} projectId={project.id} cashIn={totalPaid} />
          )}
          {/* ── ADD THIS BLOCK ── */}
          {activeTab === 'vendorbills' && (
            <VendorBillsTab key={`vb-${project.id}`} projectId={project.id} />
          )}
        </>
      )}

      {showProjMd && (
        <ProjectModal
          project={project}
          clientId={client.id}
          onClose={() => setShowProjMd(false)}
          onSaved={() => { setShowProjMd(false); refresh(); toast(project?'Project updated':'Project created'); }}
          toast={toast}
        />
      )}
    </div>
  );
}