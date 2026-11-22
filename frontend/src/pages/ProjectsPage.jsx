import { useEffect, useRef, useState } from 'react';
import { createProject, listLifecycle, listProjects } from '../api.js';

const emptyForm = { name: '', description: '', status: 'assessment' };

export default function ProjectsPage({ canEdit, onOpenProject }) {
  const [rows, setRows] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  function labelFor(code) {
    return lifecycle.find((item) => item.code === code)?.label || code;
  }

  async function refresh(query = q) {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const next = await listProjects(query.trim());
      if (id !== requestId.current) return;
      setRows(next);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    listLifecycle().then(setLifecycle).catch((err) => setError(err.message));
    refresh('');
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      const created = await createProject({
        name: form.name,
        description: form.description,
        status: form.status,
      });
      setShowForm(false);
      setForm(emptyForm);
      onOpenProject(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="main-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">A project has a name, a status, and the people assigned to it.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={() => setShowForm((open) => !open)}>
            New project
          </button>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only">Search projects</span>
          <input
            value={q}
            placeholder="Search name or description"
            onChange={(event) => {
              const value = event.target.value;
              setQ(value);
              refresh(value);
            }}
          />
        </label>
      </div>
      {showForm && canEdit ? (
        <form className="panel form-grid" onSubmit={onSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>
            Description
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {lifecycle.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">Create</button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">{q.trim() ? 'No projects match.' : 'No projects yet.'}</p>
      ) : (
        <div className="cards">
          {rows.map((row) => (
            <button key={row.id} type="button" className="card" onClick={() => onOpenProject(row.id)}>
              <span className="card__status">{labelFor(row.status)}</span>
              <strong>{row.name}</strong>
              <span className="muted">{row.description || 'No description'}</span>
              <span className="muted">
                {row.assignment_count} {row.assignment_count === 1 ? 'person' : 'people'}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
