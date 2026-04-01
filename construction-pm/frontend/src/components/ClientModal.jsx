import { useState, useEffect } from 'react';
import axios from 'axios';

const BLANK = { client_name: '', phone: '', email: '', address: '', notes: '' };

export default function ClientModal({ client, onClose, onSaved, toast }) {
  const [f, setF]     = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (client) setF({ client_name: client.client_name||'', phone: client.phone||'', email: client.email||'', address: client.address||'', notes: client.notes||'' });
    else setF(BLANK);
  }, [client]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.client_name.trim()) { toast('Client name is required', 'error'); return; }
    if (f.phone.startsWith('+91')) { toast('Remove +91 from phone number', 'error'); return;}
    setBusy(true);
    try {
      client ? await axios.put(`/api/clients/${client.id}`, f) : await axios.post('/api/clients', f);
      onSaved();
    } catch (e) { toast(e.response?.data?.error || 'Save failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onMouseDown={e => {
  if (e.target === e.currentTarget) {
    onClose();
  }
}}>
      <div className="modal">
        <div className="modal-hd">
          <div className="modal-title">{client ? 'Edit Client' : 'New Client'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-col">
            <label className="form-lbl">Client Name *</label>
            <input className="form-input" value={f.client_name} onChange={e => set('client_name', e.target.value)} placeholder="e.g. ABC Builders" />
          </div>
          <div className="modal-grid2">
            <div className="form-col">
              <label className="form-lbl">Phone</label>
              <input
                className="form-input"
                value={f.phone}
                onChange={e => {
                const raw = e.target.value;
                let val = raw.replace(/[^0-9]/g, '');

                if (raw && raw !== val) {
                  setPhoneError('❌ Enter direct number (no +91 or special chars)');
                } else {
                  setPhoneError('');
                }
                set('phone', val);
              }}
                placeholder="98XXXXXXXX"
              />
              {phoneError && (
              <div style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {phoneError}
              </div>
              )}
            </div>
            <div className="form-col">
              <label className="form-lbl">Email</label>
              <input className="form-input" type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <div className="form-col">
            <label className="form-lbl">Address</label>
            <textarea className="form-textarea" rows={2} value={f.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
          </div>
          <div className="form-col">
            <label className="form-lbl">Notes</label>
            <textarea className="form-textarea" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Any remarks..." />
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : (client ? 'Update' : 'Create Client')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
