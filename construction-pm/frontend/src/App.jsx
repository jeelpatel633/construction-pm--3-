import { useState, useCallback } from 'react';
import Sidebar      from './components/Sidebar.jsx';
import ProjectView  from './components/ProjectView.jsx';
import HomePage     from './components/HomePage.jsx';
import ClientModal  from './components/ClientModal.jsx';
import Toast        from './components/Toast.jsx';

export default function App() {
  const [selectedClient,   setSelectedClient]   = useState(null);
  const [showHome,         setShowHome]         = useState(false);
  const [showClientModal,  setShowClientModal]  = useState(false);
  const [editClient,       setEditClient]       = useState(null);
  const [sidebarKey,       setSidebarKey]       = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts,           setToasts]           = useState([]);

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const refreshSidebar = () => setSidebarKey(k => k + 1);

  const handleSelectClient = (c) => {
    setSelectedClient(c);
    setShowHome(false);
  };

  const handleShowHome = () => {
    setShowHome(true);
    setSelectedClient(null);
  };

  return (
    <div className="app">
      <Sidebar
        key={sidebarKey}
        className={sidebarCollapsed ? 'collapsed' : ''}
        selected={selectedClient}
        onSelect={handleSelectClient}
        onNew={() => { setEditClient(null); setShowClientModal(true); }}
        onHome={handleShowHome}
        showingHome={showHome}
      />

      <div className="main">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? '☰' : '✕'}
        </button>

        <div className="main-inner">
          {showHome ? (
            <HomePage />
          ) : selectedClient ? (
            <ProjectView
              client={selectedClient}
              onEditClient={c => { setEditClient(c); setShowClientModal(true); }}
              onClientDeleted={() => { setSelectedClient(null); refreshSidebar(); }}
              toast={toast}
            />
          ) : (
            <div className="welcome">
              <div className="welcome-icon">🏗️</div>
              <h2>Welcome to NAVYAKAR</h2>
              <p>Select a client or view the <button onClick={handleShowHome} style={{background:'none',border:'none',color:'var(--accent)',fontWeight:700,cursor:'pointer',fontSize:'inherit'}}>Home Dashboard</button></p>
            </div>
          )}
        </div>
      </div>

      {showClientModal && (
        <ClientModal
          client={editClient}
          onClose={() => setShowClientModal(false)}
          onSaved={() => {
            setShowClientModal(false);
            refreshSidebar();
            toast(editClient ? 'Client updated' : 'Client created');
          }}
          toast={toast}
        />
      )}

      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  );
}
