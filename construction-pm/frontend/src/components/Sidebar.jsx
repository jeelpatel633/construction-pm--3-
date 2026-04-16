import { useState, useEffect } from 'react';
import axios from 'axios';
import SidebarLogo from "./SidebarLogo";
import { FiLogOut } from "react-icons/fi";

const initials = n => n ? n.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';

// Module-level cache
const clientCache = new Map();
export function clearClientCache() { clientCache.clear(); }

export default function Sidebar({
  selected, onSelect, onNew, onHome, showingHome,
  className, currentUser, onLogout, onChangePassword, onManageUsers,
  asUser, setAsUser,
}) {
  const [allClients,   setAllClients]   = useState([]);
  const [clients,      setClients]      = useState([]);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [logoutHover,  setLogoutHover]  = useState(false);

  const fetchClients = () => {
    const cacheKey = `clients_${asUser ?? 'all'}`;
    clientCache.delete(cacheKey);
    setLoading(true);
    const params = asUser && asUser !== 'all' ? `?as_user=${asUser}` : '';
    axios.get(`/api/clients${params}`)
      .then(r => {
        clientCache.set(cacheKey, r.data);
        setAllClients(r.data);
        setClients(r.data);
        setSearch('');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const cacheKey = `clients_${asUser ?? 'all'}`;
    if (clientCache.has(cacheKey)) {
      const cached = clientCache.get(cacheKey);
      setAllClients(cached);
      setClients(cached);
      setLoading(false);
      return;
    }
    fetchClients();
  }, [asUser]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setClients(allClients); return; }
    setClients(
      allClients.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    );
  }, [search, allClients]);

  const handleNewClient = () => {
    clearClientCache();
    onNew();
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside
      className={`sidebar ${className || ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* ── Logo ── */}
      <div>
        <SidebarLogo />
      </div>

      {/* ── Home Dashboard button ── */}
      <div style={{ flexShrink: 0, padding: '10px 12px 6px' }}>
        <button
          onClick={onHome}
          style={{
            width: '100%',
            background: showingHome ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
            border: showingHome ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius)', padding: '9px 12px',
            color: showingHome ? '#F97316' : '#94A3B8',
            fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}
        >
          🏠 Home Dashboard
        </button>
      </div>

      {/* ── Admin: Viewing As + Manage Users ── */}
      {isAdmin && (
        <div style={{ flexShrink: 0 }}>
          <AdminUserSwitcher asUser={asUser} setAsUser={setAsUser} />

          {/* Manage Users button */}
          <div style={{ padding: '4px 12px 8px' }}>
            <button
              onClick={onManageUsers}
              style={{
                width: '100%',
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 'var(--radius)', padding: '8px 12px',
                color: '#F97316',
                fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              👥 Manage Users
            </button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="sidebar-search" style={{ flexShrink: 0 }}>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── New Client button ── */}
      <div className="sidebar-add" style={{ flexShrink: 0 }}>
        <button className="btn-add-client" onClick={handleNewClient}>
          <span>＋</span> New Client
        </button>
      </div>

      {/* ── Client list — scrollable ── */}
      <div className="client-list" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div className="sidebar-empty">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="sidebar-empty">
            {search ? 'No clients found.' : 'No clients yet.'}
          </div>
        ) : clients.map(c => (
          <div
            key={c.id}
            className={`client-item ${selected?.id === c.id && !showingHome ? 'active' : ''}`}
            onClick={() => onSelect(c)}
          >
            <div className="client-av">{initials(c.client_name)}</div>
            <div className="client-info">
              <div className="client-name">{c.client_name}</div>
              <div className="client-phone">{c.phone || 'No phone'}</div>
            </div>
            <div className="client-proj-count">{c.project_count}</div>
          </div>
        ))}
      </div>

      {/* ── User info + actions — pinned at bottom ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #1E293B',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#0F172A',
      }}>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#F97316', border: '2px solid #334155',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {currentUser?.display_name?.[0]?.toUpperCase() ||
           currentUser?.username?.[0]?.toUpperCase() || 'U'}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#E2E8F0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentUser?.display_name || currentUser?.username}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {isAdmin ? '👑 Admin' : '👤 User'}
          </div>
        </div>

        {/* Change password */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={onChangePassword}
            title="Change Password"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B', cursor: 'pointer', transition: 'all 0.18s ease',
              marginRight: 4,
            }}
          >
            🔑
          </button>
        </div>

        {/* Logout */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <LogoutButton onLogout={onLogout} />
        </div>
      </div>
    </aside>
  );
}

// ── Logout button with hover tooltip ─────────────────────────────────────
function LogoutButton({ onLogout }) {
  const [hover, setHover] = useState(false);
  return (
    <>
      {hover && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
          background: '#1E293B', border: '1px solid #334155',
          borderRadius: 6, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, color: '#F87171',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          Logout
          <div style={{
            position: 'absolute', top: '100%', right: 10,
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #334155',
          }} />
        </div>
      )}
      <button
        onClick={onLogout}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 8,
          background: hover ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
          border: hover ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.08)',
          color: hover ? '#EF4444' : '#64748B',
          cursor: 'pointer', transition: 'all 0.18s ease',
        }}
      >
        <FiLogOut size={16} />
      </button>
    </>
  );
}

// ── Admin "Viewing As" switcher ───────────────────────────────────────────
function AdminUserSwitcher({ asUser, setAsUser }) {
  const [users, setUsers] = useState([]);

  const fetchUsers = () => {
    axios.get('/api/auth/users').then(r => setUsers(r.data)).catch(console.error);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div style={{
      padding: '6px 12px 8px',
      background: '#0F172A',
      borderBottom: '1px solid #1E293B',
    }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: '#F97316',
        textTransform: 'uppercase', letterSpacing: 0.8,
        display: 'block', marginBottom: 4,
      }}>
        👑 Viewing As
      </label>
      <select
        value={asUser}
        onChange={e => setAsUser(e.target.value)}
        onFocus={fetchUsers}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 6,
          background: '#1E293B', border: '1px solid #334155',
          color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >
        <option value="all">📊 All Users</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
        ))}
      </select>
    </div>
  );
}