import { useEffect, useState } from 'react';
import CompanyLabel from '../components/CompanyLabel.jsx';
import {
  assignResource,
  deleteProject,
  getProject,
  listLifecycle,
  listProjectRoles,
  listResources,
  removeAssignment,
  updateAssignment,
  updateProject,
} from '../api.js';

export default function ProjectPage({ projectId, canEdit, onClose }) {
  const [project, setProject] = useState(null);
  const [form, setForm] = useState(null);
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [resourceId, setResourceId] = useState('');
  const [projectRole, setProjectRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function roleLabel(code) {
    return roles.find((item) => item.code === code)?.label || code;
  }

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [next, directory] = await Promise.all([getProject(projectId), listResources()]);
      setProject(next);
      setForm({
        name: next.name,
        description: next.description || '',
        status: next.status,
      });
      setPeople(directory);
      const available = directory.filter(
        (person) => !next.assignments.some((row) => row.resource_id === person.id),
      );
      setResourceId(available[0] ? String(available[0].id) : '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([listProjectRoles(), listLifecycle()])
      .then(([roleRows, lifecycleRows]) => {
        setRoles(roleRows);
        setLifecycle(lifecycleRows);
      })
      .catch((err) => setError(err.message));
    refresh();
  }, [projectId]);

  async function onSave(event) {
    event.preventDefault();
    setError('');
    try {
      const next = await updateProject(projectId, {
        name: form.name,
        description: form.description,
        status: form.status,
      });
      setProject(next);
      setForm({ name: next.name, description: next.description || '', status: next.status });
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    setError('');
    try {
      await deleteProject(projectId);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAssign(event) {
    event.preventDefault();
    if (!resourceId) return;
    setError('');
    try {
      const next = await assignResource(projectId, {
        resource_id: Number(resourceId),
        project_role: projectRole,
      });
      setProject(next);
      setProjectRole('member');
      const available = people.filter(
        (person) => !next.assignments.some((row) => row.resource_id === person.id),
      );
      setResourceId(available[0] ? String(available[0].id) : '');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRoleChange(resource, role) {
    setError('');
    try {
      setProject(await updateAssignment(projectId, resource, { project_role: role }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRemove(resource, name) {
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    setError('');
    try {
      const next = await removeAssignment(projectId, resource);
      setProject(next);
      const available = people.filter(
        (person) => !next.assignments.some((row) => row.resource_id === person.id),
      );
      setResourceId(available[0] ? String(available[0].id) : '');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading && !project) return <p className="muted">Loading…</p>;
  if (!project) return <p className="banner" role="alert">{error || 'Project not found'}</p>;

  const available = people.filter(
    (person) => !project.assignments.some((row) => row.resource_id === person.id),
  );

  return (
    <>
      <header className="main-header">
        <div>
          <button type="button" className="link link--back" onClick={onClose}>Projects</button>
          <h1>{project.name}</h1>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--danger" onClick={onDelete}>Delete project</button>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {canEdit && form ? (
        <form className="panel form-grid" onSubmit={onSave}>
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
            <button type="submit" className="btn btn--primary">Save</button>
          </div>
        </form>
      ) : (
        <section className="panel read-only">
          <p>{project.description || <span className="muted">No description</span>}</p>
          <p className="muted">
            Status: {lifecycle.find((item) => item.code === project.status)?.label || project.status}
          </p>
        </section>
      )}
      <h2 className="section-title">People</h2>
      {canEdit ? (
        <form className="panel form-grid" onSubmit={onAssign}>
          <label>
            Person
            <select value={resourceId} onChange={(event) => setResourceId(event.target.value)} disabled={available.length === 0}>
              {available.length === 0 ? <option value="">Everyone is assigned</option> : null}
              {available.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <label>
            Project role
            <select value={projectRole} onChange={(event) => setProjectRole(event.target.value)}>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>{role.label}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={!resourceId}>Add to project</button>
          </div>
        </form>
      ) : null}
      {project.assignments.length === 0 ? (
        <p className="empty">No one is assigned yet.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Job title</th>
              <th>Onboarded with</th>
              <th>Email</th>
              <th>Project role</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {project.assignments.map((row) => (
              <tr key={row.resource_id}>
                <td>{row.name}</td>
                <td>{row.department_name}</td>
                <td>{row.designation_name || <span className="muted">—</span>}</td>
                <td>{row.companies?.length ? row.companies.map((company) => (
                  <CompanyLabel key={company.name} name={company.name} icon={company.icon} />
                )) : <span className="muted">—</span>}</td>
                <td>{row.email}</td>
                <td>
                  {canEdit ? (
                    <select value={row.project_role} onChange={(event) => onRoleChange(row.resource_id, event.target.value)}>
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>{role.label}</option>
                      ))}
                    </select>
                  ) : roleLabel(row.project_role)}
                </td>
                {canEdit ? (
                  <td className="row-actions">
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => onRemove(row.resource_id, row.name)}>
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
