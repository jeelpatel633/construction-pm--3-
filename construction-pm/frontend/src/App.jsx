import { useState, useCallback, useEffect } from 'react';
import axios        from 'axios';
import Sidebar, { clearClientCache } from './components/Sidebar.jsx';
import ProjectView  from './components/ProjectView.jsx';
import HomePage     from './components/HomePage.jsx';
import ClientModal  from './components/ClientModal.jsx';
import Toast        from './components/Toast.jsx';
import LoginPage    from './pages/LoginPage.jsx';
import SignupPage   from './pages/SignupPage.jsx';
import ChangePasswordModal from './components/ChangePasswordModal.jsx';
import UserManagementModal from './components/UserManagementModal.jsx';

function setupAxiosAuth(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

axios.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nav_token');
      localStorage.removeItem('nav_user');
      delete axios.defaults.headers.common['Authorization'];
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// ── Detect mobile ─────────────────────────────────────────────────────────
const isMobile = () => window.innerWidth <= 768;

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const u = localStorage.getItem('nav_user'); return u ? JSON.parse(u) : null; }
    catch { return null; }
  });
  const [page,             setPage]             = useState('loading');
  const [asUser,           setAsUser]           = useState('all');
  const [selectedClient,   setSelectedClient]   = useState(null);
  const [showHome,         setShowHome]         = useState(false);
  const [showClientModal,  setShowClientModal]  = useState(false);
  const [editClient,       setEditClient]       = useState(null);
  const [sidebarKey,       setSidebarKey]       = useState(0);
  const [toasts,           setToasts]           = useState([]);
  const [showChangePwd,    setShowChangePwd]    = useState(false);
  const [showManageUsers,  setShowManageUsers]  = useState(false);

  // ── Mobile sidebar state ─────────────────────────────────────────────────
  const [sidebarOpen,      setSidebarOpen]      = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse

  // Close sidebar on mobile when route changes
  const closeMobileSidebar = () => { if (isMobile()) setSidebarOpen(false); };

  // Handle window resize — reset mobile state on desktop
  useEffect(() => {
    const onResize = () => {
      if (!isMobile()) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nav_token');
    const user  = (() => {
      try { const u = localStorage.getItem('nav_user'); return u ? JSON.parse(u) : null; }
      catch { return null; }
    })();
    if (token && user) {
      setupAxiosAuth(token);
      setCurrentUser(user);
      setPage('app');
    } else {
      setPage('login');
    }
  }, []);

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const refreshSidebar = () => {
    clearClientCache();
    setSidebarKey(k => k + 1);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setPage('app');
    setAsUser('all');
  };

  const handleLogout = () => {
    localStorage.removeItem('nav_token');
    localStorage.removeItem('nav_user');
    setupAxiosAuth(null);
    clearClientCache();
    setCurrentUser(null);
    setSelectedClient(null);
    setShowHome(false);
    setPage('login');
  };

  const handleSelectClient = (c) => {
    setSelectedClient(c);
    setShowHome(false);
    closeMobileSidebar(); // ← close drawer after selecting client on mobile
  };

  const handleShowHome = () => {
    setShowHome(true);
    setSelectedClient(null);
    closeMobileSidebar(); // ← close drawer after navigating home on mobile
  };

  const handleToggleSidebar = () => {
    if (isMobile()) {
      setSidebarOpen(o => !o); // mobile: toggle drawer
    } else {
      setSidebarCollapsed(c => !c); // desktop: collapse/expand
    }
  };

  const pdfUrl = (path) => {
    const token = localStorage.getItem('nav_token');
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}token=${token}`;
  };

  // ── Auth screens ─────────────────────────────────────────────────────────
  if (page === 'loading') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0F172A'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>🏗️</div>
        <div style={{fontSize:20,fontWeight:700,color:'#F97316',letterSpacing:3}}>NAVYAKAR</div>
        <div style={{marginTop:12,color:'#64748B',fontSize:13}}>Loading...</div>
      </div>
    </div>
  );
  if (page === 'login')  return <LoginPage  onLogin={handleLogin} onGoSignup={() => setPage('signup')} />;
  if (page === 'signup') return <SignupPage onGoLogin={() => setPage('login')} />;

  // ── Sidebar class ─────────────────────────────────────────────────────────
  const sidebarClass = [
    sidebarCollapsed ? 'collapsed' : '',
    sidebarOpen      ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Mobile backdrop — tap to close sidebar ── */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        key={sidebarKey}
        className={sidebarClass}
        selected={selectedClient}
        onSelect={handleSelectClient}
        onNew={() => { setEditClient(null); setShowClientModal(true); closeMobileSidebar(); }}
        onManageUsers={() => { setShowManageUsers(true); closeMobileSidebar(); }}
        onHome={handleShowHome}
        showingHome={showHome}
        currentUser={currentUser}
        onLogout={handleLogout}
        onChangePassword={() => { setShowChangePwd(true); closeMobileSidebar(); }}
        asUser={asUser}
        setAsUser={(uid) => {
          setAsUser(uid);
          setSelectedClient(null);
          setShowHome(true);
          clearClientCache();
          setSidebarKey(k => k + 1);
          closeMobileSidebar();
        }}
      />

      <div className="main">
        {/* Toggle button — hamburger on mobile, X on desktop when open */}
        <button
          className="sidebar-toggle"
          onClick={handleToggleSidebar}
          title="Toggle sidebar"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <div className="main-inner">
          {showHome ? (
            <HomePage currentUser={currentUser} asUser={asUser} />
          ) : selectedClient ? (
            <ProjectView
              client={selectedClient}
              onEditClient={c => { setEditClient(c); setShowClientModal(true); }}
              onClientDeleted={() => { setSelectedClient(null); refreshSidebar(); }}
              toast={toast}
              asUser={asUser}
              pdfUrl={pdfUrl}
            />
          ) : (
            <div className="welcome">
              <div className="welcome-icon">🏗️</div>
              <h2>Welcome{currentUser?.display_name ? `, ${currentUser.display_name}` : ''}!</h2>
              <p>Select a client or view the{' '}
                <button onClick={handleShowHome} style={{background:'none',border:'none',color:'var(--accent)',fontWeight:700,cursor:'pointer',fontSize:'inherit'}}>
                  Home Dashboard
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
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
          asUser={asUser}
        />
      )}

      {showManageUsers && (
        <UserManagementModal
          onClose={() => setShowManageUsers(false)}
          toast={toast}
        />
      )}

      {showChangePwd && (
        <ChangePasswordModal
          onClose={() => setShowChangePwd(false)}
          toast={toast}
        />
      )}

      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  );
}