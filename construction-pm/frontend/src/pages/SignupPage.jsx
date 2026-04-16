import { useState } from 'react';
import axios from 'axios';

export default function SignupPage({ onGoLogin }) {
  const [username,      setUsername]      = useState('');
  const [password,      setPassword]      = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [loading,       setLoading]       = useState(false);

  const signup = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim() || !adminPassword.trim()) {
      setError('All fields are required'); return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      await axios.post('/api/auth/signup', {
        username: username.trim(),
        password,
        admin_password: adminPassword,
      });
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => onGoLogin(), 2000);
    } catch (e) {
      setError(e.response?.data?.error || 'Signup failed.');
    } finally { setLoading(false); }
  };

  const fields = [
    { label:'New Username',   name:'username',       val: username,       set: setUsername,       ph:'Choose a username',    type:'text',     autoComplete:'username' },
    { label:'New Password',   name:'new-password',   val: password,       set: setPassword,       ph:'Min 6 characters',     type:'password', autoComplete:'new-password' },
    { label:'Admin Password', name:'admin-password', val: adminPassword,  set: setAdminPassword,  ph:'Enter admin password',  type:'password', autoComplete:'off' },
  ];

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)',
    }}>
      <div style={{width:'100%', maxWidth:400, padding:'0 20px'}}>

        <div style={{textAlign:'center', marginBottom:40}}>
          <div style={{fontSize:48, marginBottom:12}}>🏗️</div>
          <div style={{fontSize:28, fontWeight:800, color:'#F97316', letterSpacing:3}}>NAVYAKAR</div>
          <div style={{fontSize:13, color:'#94A3B8', marginTop:4}}>Create New Account</div>
        </div>

        {/* ✅ Wrapped in <form> */}
        <form
          onSubmit={signup}
          autoComplete="on"
          style={{
            background:'#1E293B', borderRadius:16, padding:32,
            border:'1px solid #334155', boxShadow:'0 20px 60px rgba(0,0,0,0.4)'
          }}
        >
          <div style={{fontSize:18, fontWeight:700, color:'#fff', marginBottom:8}}>New Account</div>
          <div style={{fontSize:12, color:'#64748B', marginBottom:24}}>Admin password required to create accounts</div>

          {error && (
            <div style={{background:'#450a0a', border:'1px solid #b91c1c', borderRadius:8, padding:'10px 14px', color:'#fca5a5', fontSize:13, marginBottom:16}}>
              {error}
            </div>
          )}
          {success && (
            <div style={{background:'#052e16', border:'1px solid #16a34a', borderRadius:8, padding:'10px 14px', color:'#86efac', fontSize:13, marginBottom:16}}>
              ✅ {success}
            </div>
          )}

          {fields.map(f => (
            <div key={f.label} style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6}}>
                {f.label}
                {f.label === 'Admin Password' && <span style={{color:'#F97316', marginLeft:4}}>🔒</span>}
              </label>
              <input
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                placeholder={f.ph}
                style={{
                  width:'100%', padding:'10px 14px', borderRadius:8, fontSize:14,
                  background:'#0F172A', border:'1px solid #334155', color:'#fff',
                  outline:'none', boxSizing:'border-box',
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%', padding:'12px', borderRadius:8, border:'none',
              background: loading ? '#475569' : '#F97316',
              color:'#fff', fontWeight:700, fontSize:15,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop:8, transition:'all 0.2s',
            }}
          >
            {loading ? '⏳ Creating...' : '✓ Create Account'}
          </button>

          <div style={{textAlign:'center', marginTop:20}}>
            <button
              type="button"
              onClick={onGoLogin}
              style={{background:'none', border:'none', color:'#94A3B8', fontSize:13, cursor:'pointer'}}
            >
              ← Back to <span style={{color:'#F97316', fontWeight:600}}>Sign In</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}