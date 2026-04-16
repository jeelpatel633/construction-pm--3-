import { useState } from 'react';
import axios from 'axios';

export default function ChangePasswordModal({ onClose, toast }) {
  const [oldPass,   setOldPass]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [showOld,   setShowOld]   = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  const save = async () => {
    if (!oldPass || !newPass) { toast('Both fields required', 'error'); return; }
    if (newPass.length < 6)   { toast('Min 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await axios.put('/api/auth/password', { old_password: oldPass, new_password: newPass });
      toast('Password changed successfully!');
      onClose();
    } catch (e) {
      toast(e.response?.data?.error || 'Failed', 'error');
    } finally { setLoading(false); }
  };

  const fields = [
    { label: 'Current Password', val: oldPass, set: setOldPass, show: showOld, toggle: () => setShowOld(s => !s) },
    { label: 'New Password',     val: newPass, set: setNewPass, show: showNew, toggle: () => setShowNew(s => !s) },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E293B', borderRadius: 16, padding: 28, width: 360,
        border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>🔒 Change Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {fields.map(f => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
            }}>
              {f.label}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={f.show ? 'text' : 'password'}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8,
                  fontSize: 14, background: '#0F172A', border: '1px solid #334155',
                  color: '#fff', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={f.toggle}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 16,
                }}
              >
                {f.show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 10, borderRadius: 8,
              border: '1px solid #334155', background: 'transparent',
              color: '#94A3B8', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading}
            style={{
              flex: 2, padding: 10, borderRadius: 8, border: 'none',
              background: loading ? '#475569' : '#F97316',
              color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving…' : 'Save Password'}
          </button>
        </div>
      </div>
    </div>
  );
}