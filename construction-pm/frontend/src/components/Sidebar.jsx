import { useState, useEffect } from 'react';
import axios from 'axios';

const initials = n => n ? n.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';

export default function Sidebar({ selected, onSelect, onNew, onHome, showingHome, className }) {
  const [clients, setClients] = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/clients?search=${encodeURIComponent(search)}`)
      .then(r => setClients(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <aside className={`sidebar ${className || ''}`}>
<div className="sidebar-brand">
  <div className="brand-row" style={{ justifyContent: 'center', padding: '8px 12px' }}>
<img
  src="/navyakar-logo.png"
  alt="Navyakar"
  style={{
    width: '100%',
    maxWidth: '170px',    // ⬅ was 200px, now smaller
    height: '75px',       // ⬅ was 100px, now shorter
    objectFit: 'contain',
    display: 'block',
    margin: '0 auto',
    borderRadius: '8px',
    background: '#fff',
    padding: '4px 8px',   // ⬅ was 6px 10px, now tighter
  }}
/>
  </div>
</div>

      {/* Home button */}
      <div style={{ padding:'10px 12px 4px' }}>
        <button
          onClick={onHome}
          style={{
            width:'100%',
            background: showingHome ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
            border: showingHome ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius:'var(--radius)',
            padding:'9px 12px',
            color: showingHome ? '#F97316' : '#94A3B8',
            fontFamily:'var(--font)',
            fontSize:13,
            fontWeight:600,
            cursor:'pointer',
            display:'flex',
            alignItems:'center',
            gap:8,
            transition:'all 0.15s',
          }}
        >
          🏠 Home Dashboard
        </button>
      </div>

      <div className="sidebar-search">
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

      <div className="sidebar-add">
        <button className="btn-add-client" onClick={onNew}>
          <span>＋</span> New Client
        </button>
      </div>

      <div className="client-list">
        {loading ? (
          <div className="sidebar-empty">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="sidebar-empty">{search ? 'No clients found.' : 'No clients yet.'}</div>
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
    </aside>
  );
}
