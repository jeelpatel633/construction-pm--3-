import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UserManagementModal({ onClose, toast }) {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [actionUser,  setActionUser]  = useState(null); // { id, username, action: 'password'|'delete' }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/auth/users');
      setUsers(data);
    } catch (e) {
      toast('Failed to load users', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDeleted = (userId) => {
    setUsers(u => u.filter(x => x.id !== userId));
    setActionUser(null);
    toast('User deleted successfully');
  };

  const handlePasswordChanged = () => {
    setActionUser(null);
    toast('Password updated successfully');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E293B', borderRadius: 16, padding: 28,
        width: 480, maxWidth: '95vw', maxHeight: '85vh',
        border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>👥 Manage Users</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#64748B', padding: 40 }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748B', padding: 40 }}>No users found.</div>
          ) : (
            users.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                  background: '#0F172A', border: '1px solid #1E293B',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: '#F97316', border: '2px solid #334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {(u.display_name || u.username)?.[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.display_name || u.username}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    @{u.username} · Joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setActionUser({ ...u, action: 'password' })}
                    title="Change Password"
                    style={{
                      padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                      color: '#F97316', cursor: 'pointer',
                    }}
                  >
                    🔑 Password
                  </button>
                  <button
                    onClick={() => setActionUser({ ...u, action: 'delete' })}
                    title="Delete User"
                    style={{
                      padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                      color: '#EF4444', cursor: 'pointer',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ flexShrink: 0, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px solid #334155', background: 'transparent',
              color: '#94A3B8', fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Action modals */}
      {actionUser?.action === 'password' && (
        <AdminChangePasswordModal
          user={actionUser}
          onClose={() => setActionUser(null)}
          onSuccess={handlePasswordChanged}
          toast={toast}
        />
      )}
      {actionUser?.action === 'delete' && (
        <ConfirmDeleteModal
          user={actionUser}
          onClose={() => setActionUser(null)}
          onDeleted={() => handleDeleted(actionUser.id)}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── Admin sets a user's new password ─────────────────────────────────────
function AdminChangePasswordModal({ user, onClose, onSuccess, toast }) {
  const [newPass,  setNewPass]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const save = async () => {
    if (!newPass) { toast('Enter a new password', 'error'); return; }
    if (newPass.length < 6) { toast('Min 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await axios.put(`/api/auth/admin/users/${user.id}/password`, { new_password: newPass });
      onSuccess();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E293B', borderRadius: 14, padding: 24, width: 340,
        border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>🔑 Set New Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 16px' }}>
          Setting new password for <strong style={{ color: '#E2E8F0' }}>@{user.username}</strong>
        </p>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
          New Password
        </label>
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <input
            type={showPass ? 'text' : 'password'}
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Min 6 characters"
            autoFocus
            style={{
              width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8,
              fontSize: 14, background: '#0F172A', border: '1px solid #334155',
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 16,
            }}
          >
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94A3B8', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={save} disabled={loading} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: loading ? '#475569' : '#F97316', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Saving…' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm delete user ───────────────────────────────────────────────────
function ConfirmDeleteModal({ user, onClose, onDeleted, toast }) {
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await axios.delete(`/api/auth/admin/users/${user.id}`);
      onDeleted();
    } catch (e) {
      toast(e.response?.data?.error || 'Delete failed', 'error');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E293B', borderRadius: 14, padding: 24, width: 340,
        border: '1px solid #EF4444', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 10 }}>
          Delete User?
        </div>
        <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', margin: '0 0 8px' }}>
          You are about to permanently delete
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', textAlign: 'center', margin: '0 0 6px' }}>
          @{user.username}
        </p>
        <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', margin: '0 0 22px' }}>
          This will also delete all their clients and projects. This cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94A3B8', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={loading} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: loading ? '#475569' : '#EF4444', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}