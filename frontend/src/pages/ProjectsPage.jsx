import { useEffect, useRef, useState } from 'react';
import {
  archiveProject,
  createProject,
  createProjectGroup,
  deleteProjectGroup,
  getProject,
  listLifecycle,
  listProjects,
  setProjectGroups,
  updateProjectGroup,
} from '../api.js';
import ProjectUsersDialog, { UsersButton } from './ProjectUsersDialog.jsx';
import { reportToneClass } from './reportTone.js';

const emptyForm = { name: '', description: '', status: 'assessment', group_ids: [] };
const emptyView = { name: '', description: '' };

function ViewChecks({ groups, selectedIds, onToggle, legend }) {
  if (groups.length === 0) return <p className="muted">No views yet.</p>;
  return (
    <fieldset className="check-group">
      <legend>{legend}</legend>
      <div className="check-list">
        {groups.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggle(item.id)}
            />
            {item.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProjectRow({ row, canEdit, labelFor, onOpen, onOpenUsers, onArchive }) {
  return (
    <tr>
      <td>
        <button type="button" className="link" onClick={() => onOpen(row.id)}>{row.name}</button>
      </td>
      <td className="desc-cell" title={row.description || undefined}>
        {row.description ? <div className="desc-clamp">{row.description}</div> : <span className="muted">—</span>}
      </td>
      <td>
        {row.tags?.length > 0 ? (
          <ul className="label-list">
            {row.tags.map((tag) => (
              <li key={tag.id} className="label-chip label-chip--static" title={tag.title}>{tag.name}</li>
            ))}
          </ul>
        ) : <span className="muted">—</span>}
      </td>
      <td>
        <UsersButton count={row.resource_count ?? row.assignment_count} onClick={() => onOpenUsers(row)} />
      </td>
      <td className="status-cell">
        <span className={reportToneClass(row)}>{labelFor(row.status)}</span>
        {canEdit && row.status === 'completed' ? (
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            title="Archive"
            aria-label={`Archive ${row.name}`}
            onClick={() => onArchive(row)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M3 7h18v3H3z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M5 10v9h14v-9" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M10 14h4" />
            </svg>
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export default function ProjectsPage({ canEdit, group, groups, onSelectGroup, onOpenProject, onGroupsChanged }) {
  const [rows, setRows] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [viewForm, setViewForm] = useState(emptyView);
  const [rename, setRename] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showViewForm, setShowViewForm] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersProject, setUsersProject] = useState(null);
  const requestId = useRef(0);
  const seenFilters = useRef({ q: '', group: undefined });
  const openGroupId = group && /^\d+$/.test(group) ? Number(group) : null;
  const openGroup = groups.find((item) => item.id === openGroupId) || null;

  function labelFor(code) {
    return lifecycle.find((item) => item.code === code)?.label || code;
  }

  function listParams() {
    if (group === 'none') return { ungrouped: true };
    if (openGroupId) return { groupId: openGroupId };
    return {};
  }

  async function refresh(query = q) {
    const id = ++requestId.current;
    const text = query.trim();
    setLoading(true);
    setError('');
    try {
      const next = await listProjects(text, listParams());
      if (id !== requestId.current) return;
      setRows(next);
      setAppliedQ(text);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message);
      setRows([]);
      setAppliedQ(text);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    listLifecycle().then(setLifecycle).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const previous = seenFilters.current;
    const first = previous.group === undefined;
    const groupChanged = previous.group !== group;
    seenFilters.current = { q, group };
    if (groupChanged) setShowAdd(false);
    const delay = first || groupChanged ? 0 : 300;
    const timer = window.setTimeout(() => {
      refresh(q);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, group]);

  useEffect(() => {
    setRename(openGroup ? openGroup.name : '');
  }, [openGroupId, openGroup?.name]);

  async function reloadDirectory() {
    setDirectory(await listProjects(''));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      const created = await createProject({
        name: form.name,
        description: form.description,
        status: form.status,
        group_ids: form.group_ids,
      });
      setShowForm(false);
      setForm(emptyForm);
      onOpenProject(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onCreateView(event) {
    event.preventDefault();
    setError('');
    try {
      const created = await createProjectGroup({
        name: viewForm.name,
        description: viewForm.description,
      });
      setShowViewForm(false);
      setViewForm(emptyView);
      await onGroupsChanged();
      onSelectGroup(String(created.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRename(event) {
    event.preventDefault();
    if (!openGroup) return;
    setError('');
    try {
      await updateProjectGroup(openGroup.id, { name: rename });
      await onGroupsChanged();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDeleteView() {
    if (!openGroup) return;
    if (!window.confirm(`Delete the ${openGroup.name} view? Projects in it stay.`)) return;
    setError('');
    try {
      await deleteProjectGroup(openGroup.id);
      await onGroupsChanged();
      onSelectGroup(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onToggleGroup(project, groupId) {
    setError('');
    const selected = project.groups.some((item) => item.id === groupId);
    const next = selected
      ? project.groups.filter((item) => item.id !== groupId).map((item) => item.id)
      : [...project.groups.map((item) => item.id), groupId];
    try {
      await setProjectGroups(project.id, next);
      await refresh();
      if (showAdd) await reloadDirectory();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onArchive(project) {
    setError('');
    try {
      await archiveProject(project.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openUsers(row) {
    setError('');
    try {
      setUsersProject(await getProject(row.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleAdd() {
    setError('');
    if (showAdd) {
      setShowAdd(false);
      return;
    }
    try {
      await reloadDirectory();
      setShowAdd(true);
    } catch (err) {
      setError(err.message);
    }
  }

  const emptyLabel = appliedQ
    ? 'No projects match.'
    : openGroup
      ? 'No projects in this view.'
      : group === 'none'
        ? 'Every project is in a view.'
        : 'No projects yet.';

  return (
    <>
      <header className="main-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">Views filter this list. A project can sit in more than one view.</p>
        </div>
        {canEdit ? (
          <div className="header-actions">
            <button type="button" className="btn btn--secondary" onClick={() => setShowViewForm((open) => !open)}>
              New view
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setShowForm((open) => !open)}>
              New project
            </button>
          </div>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {showViewForm && canEdit ? (
        <form className="panel form-grid" onSubmit={onCreateView}>
          <label>
            View name
            <input
              value={viewForm.name}
              onChange={(event) => setViewForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Description
            <input
              value={viewForm.description}
              onChange={(event) => setViewForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">Create view</button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowViewForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {openGroup ? (
        <div className="view-tools">
          {openGroup.description ? <p className="muted">{openGroup.description}</p> : null}
          {canEdit ? (
            <form className="view-rename" onSubmit={onRename}>
              <label>
                Rename view
                <input value={rename} onChange={(event) => setRename(event.target.value)} required />
              </label>
              <button type="submit" className="btn btn--secondary btn--sm">Save name</button>
              <button type="button" className="btn btn--danger btn--sm" onClick={onDeleteView}>Delete view</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={toggleAdd}>
                {showAdd ? 'Hide projects' : 'Add projects'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {showAdd && openGroup ? (
        <section className="panel">
          <h2>Add projects to {openGroup.name}</h2>
          {directory.length === 0 ? <p className="muted">No projects yet.</p> : (
            <div className="check-list">
              {directory.map((project) => {
                const checked = project.groups.some((item) => item.id === openGroup.id);
                return (
                  <label key={project.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleGroup(project, openGroup.id)}
                    />
                    {project.name}
                  </label>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only">Search projects</span>
          <input
            value={q}
            placeholder="Search name or description"
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
      </div>
      {showForm && canEdit ? (
        <form className="panel form-grid" onSubmit={onSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="field-wide">
            Description
            <textarea
              rows={3}
              placeholder="What this project covers"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {lifecycle.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>
          <ViewChecks
            groups={groups}
            selectedIds={form.group_ids}
            legend="Views"
            onToggle={(groupId) => {
              setForm((current) => {
                const selected = current.group_ids.includes(groupId);
                return {
                  ...current,
                  group_ids: selected
                    ? current.group_ids.filter((id) => id !== groupId)
                    : [...current.group_ids, groupId],
                };
              });
            }}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">Create</button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">{emptyLabel}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Labels</th>
              <th>People</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ProjectRow
                key={row.id}
                row={row}
                canEdit={canEdit}
                labelFor={labelFor}
                onOpen={onOpenProject}
                onOpenUsers={openUsers}
                onArchive={onArchive}
              />
            ))}
          </tbody>
        </table>
      )}
      {usersProject ? (
        <ProjectUsersDialog
          project={usersProject}
          canEdit={canEdit}
          onClose={() => setUsersProject(null)}
          onUpdated={(next) => {
            setUsersProject(next);
            setRows((current) => current.map((row) => (
              row.id === next.id
                ? { ...row, assignment_count: next.assignment_count, resource_count: next.resource_count }
                : row
            )));
          }}
        />
      ) : null}
    </>
  );
}
