import { useState, useEffect } from 'react';
import axios from 'axios';

const STATUSES = ['planning','active','on_hold','completed','cancelled'];
const BLANK = { project_name:'', location:'', start_date:'', end_date:'', status:'planning', notes:'' };

export default function ProjectModal({ project, clientId, onClose, onSaved, toast }) {
  const [f, setF]       = useState(BLANK);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project) setF({
      project_name: project.project_name || '',
      location:     project.location     || '',
      start_date:   project.start_date   ? project.start_date.slice(0,10) : '',
      end_date:     project.end_date     ? project.end_date.slice(0,10)   : '',
      status:       project.status       || 'planning',
      notes:        project.notes        || '',
    });
    else setF(BLANK);
  }, [project]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.project_name.trim()) { toast('Project name is required', 'error'); return; }
    setBusy(true);
    try {
      if (project) await axios.put(`/api/projects/${project.id}`, f);
      else         await axios.post('/api/projects', { ...f, client_id: clientId });
      onSaved();
    } catch (e) { toast(e.response?.data?.error || 'Save failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <div className="modal-title">{project ? 'Edit Project' : 'New Project'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-col">
            <label className="form-lbl">Project Name *</label>
            <input className="form-input" value={f.project_name} onChange={e => set('project_name', e.target.value)} placeholder="e.g. Ahmedabad Commercial Complex" />
          </div>
          <div className="modal-grid2">
            <div className="form-col">
              <label className="form-lbl">Location</label>
              <input className="form-input" value={f.location} onChange={e => set('location', e.target.value)} placeholder="City, State" />
            </div>
            <div className="form-col">
              <label className="form-lbl">Status</label>
              <select className="form-select" value={f.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-col">
              <label className="form-lbl">Start Date</label>
              <input className="form-input" type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-col">
              <label className="form-lbl">End Date</label>
              <input className="form-input" type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="form-col">
            <label className="form-lbl">Notes</label>
            <textarea className="form-textarea" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Project notes..." />
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : (project ? 'Update' : 'Create Project')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
