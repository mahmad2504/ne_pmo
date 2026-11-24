import { useEffect, useState } from 'react';
import { deleteProjectGroup, listProjectGroups, listProjects, setProjectGroups, updateProjectGroup } from '../api.js';

function memberIds(projects, viewId) {
  return new Set(
    projects
      .filter((project) => project.groups?.some((item) => item.id === viewId))
      .map((project) => project.id),
  );
}

export default function EditViewPage({ viewId, onGroupsChanged, onClose, onDeleted }) {
  const [view, setView] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [initial, setInitial] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMissing(false);
    Promise.all([listProjectGroups(), listProjects('')])
      .then(([viewRows, projectRows]) => {
        if (!active) return;
        const found = viewRows.find((item) => item.id === viewId) || null;
        setView(found);
        setMissing(!found);
        setName(found?.name || '');
        setDescription(found?.description || '');
        const visible = projectRows.filter((project) => {
          const inView = project.groups?.some((item) => item.id === viewId);
          return !project.archived || inView;
        });
        const members = memberIds(projectRows, viewId);
        setProjects(visible);
        setSelected(new Set(members));
        setInitial(members);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setView(null);
        setProjects([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewId]);

  function toggleProject(projectId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function onSave(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateProjectGroup(viewId, { name, description });
      const changed = projects.filter((project) => selected.has(project.id) !== initial.has(project.id));
      await Promise.all(changed.map((project) => {
        const currentIds = (project.groups || []).map((item) => item.id);
        const next = selected.has(project.id)
          ? (currentIds.includes(viewId) ? currentIds : [...currentIds, viewId])
          : currentIds.filter((id) => id !== viewId);
        return setProjectGroups(project.id, next);
      }));
      await onGroupsChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const label = name.trim() || 'this';
    if (!window.confirm(`Delete the ${label} view? Projects in it stay.`)) return;
    setError('');
    try {
      await deleteProjectGroup(viewId);
      await onGroupsChanged();
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (!view) {
    return (
      <>
        <header className="main-header">
          <div>
            <button type="button" className="link link--back" onClick={onClose}>Projects</button>
            <h1>{missing ? 'View not found' : 'Edit view'}</h1>
          </div>
        </header>
        {error ? <p className="banner" role="alert">{error}</p> : null}
      </>
    );
  }

  return (
    <div className="view-edit-page">
      <header className="main-header">
        <div>
          <button type="button" className="link link--back" onClick={onClose}>Projects</button>
          <h1>Edit view</h1>
          {view?.name ? <p className="subtitle">{view.name}</p> : null}
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn--danger" onClick={onDelete} disabled={saving}>Delete view</button>
        </div>
      </header>
      <form className="panel form-grid view-edit" onSubmit={onSave}>
        {error ? <p className="banner field-wide" role="alert">{error}</p> : null}
        <label>
          View name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="field-wide">
          <h2 className="section-title">Projects</h2>
          {projects.length === 0 ? <p className="muted">No projects yet.</p> : (
            <div className="check-list check-list--stack">
              {projects.map((project) => (
                <label key={project.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(project.id)}
                    onChange={() => toggleProject(project.id)}
                  />
                  <span className="check-name">{project.name}</span>
                  {project.archived ? <span className="flag">Archived</span> : null}
                  {project.description ? (
                    <span className="check-desc" title={project.description}>{project.description}</span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="form-actions field-wide">
          <button type="submit" className="btn btn--primary" disabled={saving}>Save</button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
