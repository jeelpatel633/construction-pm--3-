import { useState } from 'react';
import axios from 'axios';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function LoginPage({ onLogin, onGoSignup }) {
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  // Modals
  const [showForgot,     setShowForgot]     = useState(false);
  const [showEmergency,  setShowEmergency]  = useState(false);

  const login = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password'); return;
    }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/api/auth/login', {
        username: username.trim().toLowerCase(),
        password,
      });
      localStorage.setItem('nav_token', data.token);
      localStorage.setItem('nav_user',  JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      onLogin(data.user);
    } catch (e) {
      setTimeout(() => {
        console.log("LOGIN ERROR:", e.response?.data);
        setError(e.response?.data?.error || 'Login failed. Please try again.');
      }, 1000);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#F97316', letterSpacing: 3 }}>NAVYAKAR</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Construction Project Manager</div>
        </div>

        <form
          onSubmit={login}
          autoComplete="on"
          style={{
            background: '#1E293B', borderRadius: 16, padding: 32,
            border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 24 }}>Sign In</div>

          {error && (
            <div style={{
              background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 8,
              padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Username
            </label>
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
                background: '#0F172A', border: '1px solid #334155', color: '#fff',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password with eye toggle */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                autoComplete="current-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8, fontSize: 14,
                  background: '#0F172A', border: '1px solid #334155', color: '#fff',
                  outline: 'none', boxSizing: 'border-box',
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
          </div>

          {/* Forgot password link — below password field */}
          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{
                background: 'none', border: 'none', color: '#94A3B8',
                fontSize: 12, cursor: 'pointer', padding: 0,
              }}
            >
              Forgot password? <span style={{ color: '#F97316' }}>Reset it</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: loading ? '#475569' : '#F97316',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Signing in...' : '→ Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              type="button"
              onClick={onGoSignup}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}
            >
              New user? <span style={{ color: '#F97316', fontWeight: 600 }}>Create account</span>
            </button>
          </div>
        </form>

        {/* Admin emergency reset — subtle link at bottom */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setShowEmergency(s => !s)}
            style={{
              background: 'none', border: 'none', color: '#334155',
              fontSize: 11, cursor: 'pointer', padding: 0,
            }}
          >
            Admin emergency reset
          </button>
        </div>

        {showEmergency && <AdminEmergencyReset onClose={() => setShowEmergency(false)} />}

        <div style={{ textAlign: 'center', marginTop: 12, color: '#475569', fontSize: 11 }}>
          Navyakar Construction © 2026
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

// ── Admin Emergency Reset Panel ──────────────────────────────────────────
function AdminEmergencyReset({ onClose }) {
  const [resetKey,  setResetKey]  = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [showKey,   setShowKey]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const submit = async () => {
    if (!resetKey || !newPass) { setError('Both fields required'); return; }
    if (newPass.length < 6)   { setError('Min 6 characters'); return; }
    setLoading(true); setError('');
    try {
      await axios.post('/api/auth/admin/emergency-reset', {
        reset_key:    resetKey,
        new_password: newPass,
      });
      setSuccess('Admin password updated! Please login.');
      setTimeout(onClose, 2500);
    } catch (e) {
      setError(e.response?.data?.error || 'Reset failed');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8, fontSize: 13,
    background: '#0F172A', border: '1px solid #334155', color: '#fff',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: '#1E293B', border: '1px solid #F97316', borderRadius: 12,
      padding: 20, marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>🔐 Admin Emergency Reset</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>✕</button>
      </div>

      <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 14px' }}>
        Use the <code style={{ color: '#94A3B8' }}>ADMIN_RESET_KEY</code> from your <code style={{ color: '#94A3B8' }}>.env</code> file to reset the admin password.
      </p>

      {error   && <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 8, padding: '8px 12px', color: '#86efac', fontSize: 12, marginBottom: 10 }}>✅ {success}</div>}

      {[
        { label: 'Emergency Reset Key', val: resetKey, set: setResetKey, show: showKey, toggle: () => setShowKey(s => !s), ph: 'From .env ADMIN_RESET_KEY' },
        { label: 'New Admin Password',  val: newPass,  set: setNewPass,  show: showPass, toggle: () => setShowPass(s => !s), ph: 'Min 6 characters' },
      ].map(f => (
        <div key={f.label} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 }}>{f.label}</label>
          <div style={{ position: 'relative' }}>
            <input type={f.show ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
            <button type="button" onClick={f.toggle} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14 }}>
              {f.show ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={submit}
        disabled={loading}
        style={{
          width: '100%', padding: '9px', borderRadius: 8, border: 'none',
          background: loading ? '#475569' : '#F97316',
          color: '#fff', fontWeight: 700, fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
        }}
      >
        {loading ? 'Resetting…' : 'Reset Admin Password'}
      </button>
    </div>
  );
}