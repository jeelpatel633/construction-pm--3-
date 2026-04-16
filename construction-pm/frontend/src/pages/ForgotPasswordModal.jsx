import { useState } from 'react';
import axios from 'axios';

/**
 * ForgotPasswordModal
 * Step 1 — Enter username → check reset status
 * Step 2a — Free reset available → just enter new password
 * Step 2b — Free reset used → must also provide admin password
 */
export default function ForgotPasswordModal({ onClose }) {
  const [step,        setStep]        = useState('username'); // 'username' | 'reset'
  const [username,    setUsername]    = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [adminPass,   setAdminPass]   = useState('');
  const [freeAvail,   setFreeAvail]   = useState(true);
  const [showNew,     setShowNew]     = useState(false);
  const [showAdmin,   setShowAdmin]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  // ── Step 1: check username ────────────────────────────────────────────
  const checkUsername = async () => {
    if (!username.trim()) { setError('Please enter your username'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/api/auth/check-reset-status', {
        username: username.trim(),
      });
      setFreeAvail(data.free_reset_available);
      setStep('reset');
    } catch (e) {
      setError(e.response?.data?.error || 'User not found');
    } finally { setLoading(false); }
  };

  // ── Step 2: submit new password ───────────────────────────────────────
  const submitReset = async () => {
    if (!newPass) { setError('Please enter a new password'); return; }
    if (newPass.length < 6) { setError('Minimum 6 characters'); return; }
    if (!freeAvail && !adminPass) { setError('Admin password required'); return; }
    setLoading(true); setError('');
    try {
      await axios.post('/api/auth/forgot-password', {
        username:       username.trim(),
        new_password:   newPass,
        admin_password: freeAvail ? undefined : adminPass,
      });
      setSuccess('Password reset! You can now login.');
    } catch (e) {
      setError(e.response?.data?.error || 'Reset failed');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8,
    fontSize: 14, background: '#0F172A', border: '1px solid #334155',
    color: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  const eyeBtn = (show, toggle) => (
    <button
      type="button"
      onClick={toggle}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 16,
      }}
    >
      {show ? '🙈' : '👁️'}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1E293B', borderRadius: 16, padding: 28, width: 380,
        border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>🔓 Reset Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {success ? (
          /* ── Success state ── */
          <div>
            <div style={{
              background: '#052e16', border: '1px solid #16a34a', borderRadius: 10,
              padding: '14px 16px', color: '#86efac', fontSize: 14, marginBottom: 20, textAlign: 'center',
            }}>
              ✅ {success}
            </div>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: 11, borderRadius: 8, border: 'none',
                background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              ← Back to Login
            </button>
          </div>

        ) : step === 'username' ? (
          /* ── Step 1: Username ── */
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20, marginTop: 0 }}>
              Enter your username to begin the password reset process.
            </p>

            {error && <ErrorBox msg={error} />}

            <Field label="Your Username">
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 14 }}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkUsername()}
                  placeholder="Enter your username"
                  autoFocus
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={onClose} style={secondaryBtn}>Cancel</button>
              <button onClick={checkUsername} disabled={loading} style={primaryBtn(loading)}>
                {loading ? 'Checking…' : 'Continue →'}
              </button>
            </div>
          </div>

        ) : (
          /* ── Step 2: Set new password ── */
          <div>
            {/* Status badge */}
            <div style={{
              background: freeAvail ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
              border: `1px solid ${freeAvail ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: freeAvail ? '#86efac' : '#FED7AA',
            }}>
              {freeAvail
                ? '✅ One-time free reset available for this account.'
                : '⚠️ Free reset already used. Admin password required.'}
            </div>

            {error && <ErrorBox msg={error} />}

            {/* New password */}
            <Field label="New Password">
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  style={inputStyle}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitReset()}
                  placeholder="Min 6 characters"
                  autoFocus
                />
                {eyeBtn(showNew, () => setShowNew(s => !s))}
              </div>
            </Field>

            {/* Admin password — only shown when free reset is used */}
            {!freeAvail && (
              <Field label={<>Admin Password <span style={{ color: '#F97316' }}>🔒</span></>}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAdmin ? 'text' : 'password'}
                    style={inputStyle}
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitReset()}
                    placeholder="Enter admin password to authorize"
                  />
                  {eyeBtn(showAdmin, () => setShowAdmin(s => !s))}
                </div>
              </Field>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => { setStep('username'); setError(''); setNewPass(''); setAdminPass(''); }} style={secondaryBtn}>
                ← Back
              </button>
              <button onClick={submitReset} disabled={loading} style={primaryBtn(loading)}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 8,
      padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 14,
    }}>
      {msg}
    </div>
  );
}

const secondaryBtn = {
  flex: 1, padding: '10px', borderRadius: 8,
  border: '1px solid #334155', background: 'transparent',
  color: '#94A3B8', fontWeight: 600, cursor: 'pointer', fontSize: 13,
};

const primaryBtn = (loading) => ({
  flex: 2, padding: '10px', borderRadius: 8, border: 'none',
  background: loading ? '#475569' : '#F97316',
  color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13,
});