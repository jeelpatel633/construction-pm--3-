import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SidebarLogo from "./SidebarLogo";
import { FiLogOut, FiChevronDown, FiChevronUp } from "react-icons/fi";

const initials = n =>
  n ? n.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

// ── Module-level cache ────────────────────────────────────────────────────
const clientCache = new Map();
export function clearClientCache() { clientCache.clear(); }

// ── Main Sidebar ──────────────────────────────────────────────────────────
export default function Sidebar({
  selected, onSelect, onNew, onHome, showingHome,
  className, currentUser, onLogout, onChangePassword, onManageUsers,
  asUser, setAsUser,
}) {
  const [allClients, setAllClients] = useState([]);
  const [clients,    setClients]    = useState([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [adminOpen,  setAdminOpen]  = useState(false);
  const [hasScroll,  setHasScroll]  = useState(false);

  const listRef = useRef(null);

  // ── Fetch clients ────────────────────────────────────────────────────
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

  // ── Search filter ────────────────────────────────────────────────────
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

  // ── Detect if list is scrollable (to show/hide shadow) ──────────────
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const check = () => setHasScroll(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clients, loading]);

  const handleNewClient = () => {
    clearClientCache();
    onNew();
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside
      className={`sidebar ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#0B1120',
      }}
    >

      {/* ── Logo ── */}
      <div style={{ flexShrink: 0, padding: '2px 0 0' }}>
        <SidebarLogo />
      </div>

      {/* ── Home Dashboard ── */}
      <div style={{ flexShrink: 0, padding: '6px 12px 4px' }}>
        <button
          onClick={onHome}
          style={{
            width: '100%',
            background: showingHome ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
            border: showingHome
              ? '1px solid rgba(249,115,22,0.4)'
              : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            padding: '8px 12px',
            color: showingHome ? '#F97316' : '#94A3B8',
            fontFamily: 'var(--font)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
        >
          🏠 Home Dashboard
        </button>
      </div>

      {/* ── Admin Panel (collapsible) ── */}
      {isAdmin && (
        <div style={{ flexShrink: 0 }}>

          {/* Collapsible toggle header */}
          <button
            onClick={() => setAdminOpen(o => !o)}
            style={{
              width: '100%',
              padding: '5px 14px',
              background: 'none',
              border: 'none',
              borderTop: '1px solid #1E293B',
              borderBottom: adminOpen ? 'none' : '1px solid #1E293B',
              color: '#F97316',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.9,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font)',
              transition: 'background 0.15s',
            }}
          >
            <span>👑 Admin Controls</span>
            {adminOpen
              ? <FiChevronUp size={13} />
              : <FiChevronDown size={13} />
            }
          </button>

          {/* Collapsible content */}
          {adminOpen && (
            <div style={{
              background: 'rgba(249,115,22,0.04)',
              borderBottom: '1px solid #1E293B',
              padding: '6px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <AdminUserSwitcher asUser={asUser} setAsUser={setAsUser} />

              <button
                onClick={onManageUsers}
                style={{
                  width: '100%',
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.2)',
                  borderRadius: 7,
                  padding: '7px 12px',
                  color: '#F97316',
                  fontFamily: 'var(--font)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s',
                }}
              >
                👥 Manage Users
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Search ── */}
      <div className="sidebar-search" style={{ flexShrink: 0 }}>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder={
              allClients.length > 0
                ? `Search ${allClients.length} clients...`
                : 'Search clients...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
                lineHeight: 1,
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── New Client button ── */}
      <div className="sidebar-add" style={{ flexShrink: 0 }}>
        <button className="btn-add-client" onClick={handleNewClient}>
          <span>＋</span> New Client
        </button>
      </div>

      {/* ── Client count strip ── */}
      {!loading && allClients.length > 0 && (
        <div style={{
          flexShrink: 0,
          padding: '2px 14px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 0.5 }}>
            {search
              ? `${clients.length} of ${allClients.length} clients`
              : `${allClients.length} client${allClients.length !== 1 ? 's' : ''}`
            }
          </span>
          {hasScroll && (
            <span style={{ fontSize: 9, color: '#334155', fontWeight: 600 }}>
              scroll ↓
            </span>
          )}
        </div>
      )}

      {/* ── Client list — scrollable with fade shadow ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

        <div
          ref={listRef}
          className="client-list"
          style={{
            height: '100%',
            overflowY: 'auto',
            paddingBottom: 8,
            // Custom scrollbar
            scrollbarWidth: 'thin',
            scrollbarColor: '#1E293B transparent',
          }}
        >
          {loading ? (
            <div className="sidebar-empty" style={{ padding: '24px 0', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
              Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="sidebar-empty" style={{ padding: '24px 12px', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{search ? '🔎' : '👤'}</div>
              {search ? `No results for "${search}"` : 'No clients yet.'}
            </div>
          ) : (
            clients.map(c => (
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
            ))
          )}
        </div>

        {/* Fade shadow at bottom — signals more content below */}
        {hasScroll && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 48,
              background: 'linear-gradient(to bottom, transparent, #0B1120)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* ── User info + actions — pinned at bottom ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #1E293B',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#0B1120',
      }}>

        {/* Avatar */}
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#F97316',
          border: '2px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}>
          {currentUser?.display_name?.[0]?.toUpperCase() ||
           currentUser?.username?.[0]?.toUpperCase() || 'U'}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#E2E8F0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentUser?.display_name || currentUser?.username}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            {isAdmin ? '👑 Admin' : '👤 User'}
          </div>
        </div>

        {/* Change password */}
        <button
          onClick={onChangePassword}
          title="Change Password"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748B',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
            e.currentTarget.style.color = '#94A3B8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#64748B';
          }}
        >
          🔑
        </button>

        {/* Logout */}
        <LogoutButton onLogout={onLogout} />
      </div>
    </aside>
  );
}

// ── Logout button with hover tooltip ─────────────────────────────────────
function LogoutButton({ onLogout }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          right: 0,
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: '#F87171',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}>
          Logout
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 10,
            width: 0,
            height: 0,
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
        title="Logout"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 7,
          background: hover ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
          border: hover
            ? '1px solid rgba(239,68,68,0.35)'
            : '1px solid rgba(255,255,255,0.08)',
          color: hover ? '#EF4444' : '#64748B',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
      >
        <FiLogOut size={15} />
      </button>
    </div>
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
    <div>
      <label style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#F97316',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        display: 'block',
        marginBottom: 4,
      }}>
        Viewing As
      </label>
      <select
        value={asUser}
        onChange={e => setAsUser(e.target.value)}
        onFocus={fetchUsers}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          background: '#1E293B',
          border: '1px solid #334155',
          color: '#fff',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="all">📊 All Users</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.display_name || u.username}
          </option>
        ))}
      </select>
    </div>
  );
}