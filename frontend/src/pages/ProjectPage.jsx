import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  archiveProject,
  assignResource,
  createStatusReport,
  deleteContribution,
  deleteProject,
  deleteStatusReport,
  getProject,
  listLifecycle,
  listProjectGroups,
  listProjectRoles,
  listResources,
  listStatusReports,
  listTags,
  moveAssignment,
  removeAssignment,
  setProjectGroups,
  updateAssignment,
  updateContribution,
  updateProject,
  updateStatusReport,
} from '../api.js';
import AssignResourceForm from './AssignResourceForm.jsx';
import ProjectReports from './ProjectReports.jsx';
import RemoveResourceDialog from './RemoveResourceDialog.jsx';

const REPORT_PAGE_SIZE = 5;

function snapshot(project) {
  return {
    name: project.name,
    description: project.description || '',
    cadence: project.report_cadence_days == null ? '' : String(project.report_cadence_days),
  };
}

function parseCadence(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed) || Number(trimmed) > 365) {
    return { error: 'Report cadence must be a whole number from 0 to 365, or blank for none.' };
  }
  return { value: Number(trimmed) };
}

function utcDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function FoldSection({ title, count, actionLabel, onAction, empty, children }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  function runAction() {
    setOpen(true);
    onAction?.();
  }

  return (
    <div className="subprojects project-fold">
      <div className="subprojects__header">
        <button
          type="button"
          className="subprojects__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className={`subprojects__chevron${open ? ' subprojects__chevron--open' : ''}`} aria-hidden="true" />
          <span className="subprojects__label">{title}</span>
          <span className="subprojects__count">{count}</span>
        </button>
        {actionLabel ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={runAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div id={panelId} className="project-fold__panel" hidden={!open}>
        {count === 0 ? <p className="empty">{empty}</p> : children}
      </div>
    </div>
  );
}

export default function ProjectPage({ projectId, canEdit, onClose, registerLeaveGuard }) {
  const [project, setProject] = useState(null);
  const [form, setForm] = useState(null);
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [groups, setGroups] = useState([]);
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [editingContribution, setEditingContribution] = useState(null);
  const [contributionBusy, setContributionBusy] = useState(false);
  const [contributionError, setContributionError] = useState('');
  const [reports, setReports] = useState([]);
  const [latestReportAt, setLatestReportAt] = useState(null);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [leavePrompt, setLeavePrompt] = useState(null);
  const savedRef = useRef(null);
  const draftRef = useRef(null);
  const reportDirtyRef = useRef(false);

  const isDirty = useCallback(() => {
    if (reportDirtyRef.current) return true;
    if (!savedRef.current || !draftRef.current) return false;
    return JSON.stringify(savedRef.current) !== JSON.stringify(draftRef.current);
  }, []);

  useEffect(() => {
    if (!registerLeaveGuard) return undefined;
    const guard = {
      isDirty,
      confirm: () => new Promise((resolve) => setLeavePrompt({ resolve })),
    };
    return registerLeaveGuard(guard);
  }, [registerLeaveGuard, isDirty]);

  useEffect(() => {
    function onBeforeUnload(event) {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function remember(next) {
    const snap = snapshot(next);
    savedRef.current = snap;
    draftRef.current = snap;
    setForm(snap);
    setProject(next);
  }

  async function refreshReports(page = reportPage) {
    setReportBusy(true);
    setReportError('');
    try {
      const result = await listStatusReports(projectId, {
        limit: REPORT_PAGE_SIZE,
        offset: (page - 1) * REPORT_PAGE_SIZE,
      });
      setReports(result.items ?? []);
      setLatestReportAt(result.latest_report_at ?? null);
      setReportTotal(result.total ?? 0);
      setReportPage(page);
      const detail = await getProject(projectId);
      setProject(detail);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      getProject(projectId),
      listResources(),
      listProjectRoles(),
      listLifecycle(),
      listProjectGroups(),
      listTags(),
      listStatusReports(projectId, { limit: REPORT_PAGE_SIZE, offset: 0 }),
    ])
      .then(([next, directory, roleRows, lifecycleRows, groupRows, tagRows, reportPageResult]) => {
        if (!active) return;
        const snap = snapshot(next);
        savedRef.current = snap;
        draftRef.current = snap;
        setProject(next);
        setForm(snap);
        setPeople(directory);
        setRoles(roleRows);
        setLifecycle(lifecycleRows);
        setGroups(groupRows);
        setLabels(tagRows);
        setReports(reportPageResult.items ?? []);
        setLatestReportAt(reportPageResult.latest_report_at ?? null);
        setReportTotal(reportPageResult.total ?? 0);
        setReportPage(1);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  function roleLabel(code) {
    return roles.find((item) => item.code === code)?.label || code;
  }

  async function savePatch(body) {
    setError('');
    const next = await updateProject(projectId, body);
    remember(next);
    return next;
  }

  async function commitName(event) {
    const name = event.target.value;
    draftRef.current = { ...draftRef.current, name };
    if (name.trim() === savedRef.current?.name) return;
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await savePatch({ name });
    } catch (err) {
      setError(err.message);
    }
  }

  async function commitDescription(event) {
    const description = event.target.value;
    draftRef.current = { ...draftRef.current, description };
    if (description === (savedRef.current?.description ?? '')) return;
    try {
      await savePatch({ description });
    } catch (err) {
      setError(err.message);
    }
  }

  async function commitCadence(event) {
    const cadence = event.target.value;
    draftRef.current = { ...draftRef.current, cadence };
    const parsed = parseCadence(cadence);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const saved = savedRef.current?.cadence ?? '';
    if ((parsed.value == null ? '' : String(parsed.value)) === saved) return;
    try {
      await savePatch({ report_cadence_days: parsed.value });
    } catch (err) {
      setError(err.message);
    }
  }

  async function onStatus(status) {
    setProject((current) => ({ ...current, status }));
    try {
      await savePatch({ status });
    } catch (err) {
      setError(err.message);
      setProject((current) => ({ ...current, status: project.status }));
    }
  }

  async function onPmo(checked) {
    setProject((current) => ({ ...current, reports_with_pmo: checked }));
    try {
      await savePatch({ reports_with_pmo: checked });
    } catch (err) {
      setError(err.message);
      setProject((current) => ({ ...current, reports_with_pmo: !checked }));
    }
  }

  async function onToggleGroup(groupId) {
    if (!project) return;
    setError('');
    const selected = project.groups.some((item) => item.id === groupId);
    const next = selected
      ? project.groups.filter((item) => item.id !== groupId).map((item) => item.id)
      : [...project.groups.map((item) => item.id), groupId];
    try {
      const updated = await setProjectGroups(projectId, next);
      setProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onToggleLabel(name) {
    if (!project) return false;
    setError('');
    const selected = project.tags.some((item) => item.name.toLowerCase() === name.toLowerCase());
    const next = selected
      ? project.tags.filter((item) => item.name.toLowerCase() !== name.toLowerCase()).map((item) => item.name)
      : [...project.tags.map((item) => item.name), name];
    try {
      remember(await updateProject(projectId, { tags: next }));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    setError('');
    try {
      await deleteProject(projectId);
      savedRef.current = draftRef.current;
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onArchive() {
    setError('');
    try {
      await archiveProject(projectId);
      savedRef.current = draftRef.current;
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAssign(body) {
    setAssignBusy(true);
    setAssignError('');
    try {
      remember(await assignResource(projectId, body));
      setAdding(false);
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignBusy(false);
    }
  }

  async function onRoleChange(resourceId, role) {
    setError('');
    try {
      remember(await updateAssignment(projectId, resourceId, { project_role: role }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onUtilization(row, text) {
    if (!/^\d+$/.test(text.trim()) || Number(text) > 100) {
      setError('Utilization must be a whole number from 0 to 100.');
      return;
    }
    const percent = Number(text);
    if (percent === row.utilization_percent) return;
    setError('');
    try {
      remember(await updateAssignment(projectId, row.resource_id, { utilization_percent: percent }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRemoveConfirm(choice) {
    setRemoveBusy(true);
    setRemoveError('');
    try {
      if (choice.record) {
        const body = { unassigned: true, ended_at: choice.endedAt };
        if (choice.startedAt) body.started_at = choice.startedAt;
        if (choice.highlights) body.highlights = choice.highlights;
        remember(await moveAssignment(projectId, choice.resourceId, body));
      } else {
        remember(await removeAssignment(projectId, choice.resourceId));
      }
      setRemoving(null);
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemoveBusy(false);
    }
  }

  async function onSaveContribution(event) {
    event.preventDefault();
    if (!editingContribution) return;
    const formData = new FormData(event.currentTarget);
    const fromDate = String(formData.get('from') || '');
    const toDate = String(formData.get('to') || '');
    const utilization = String(formData.get('utilization') || '');
    if (toDate < fromDate) {
      setContributionError('End date cannot be before the contribution started');
      return;
    }
    if (!/^\d+$/.test(utilization.trim()) || Number(utilization) > 100) {
      setContributionError('Utilization must be a whole number from 0 to 100.');
      return;
    }
    setContributionBusy(true);
    setContributionError('');
    try {
      remember(await updateContribution(projectId, editingContribution.id, {
        started_at: `${fromDate}T00:00:00Z`,
        ended_at: `${toDate}T00:00:00Z`,
        utilization_percent: Number(utilization),
        project_role: formData.get('role'),
        highlights: String(formData.get('highlights') || ''),
      }));
      setEditingContribution(null);
    } catch (err) {
      setContributionError(err.message);
    } finally {
      setContributionBusy(false);
    }
  }

  async function onDeleteContribution(contribution) {
    if (!window.confirm(`Delete ${contribution.name}'s saved contribution?`)) return;
    setError('');
    try {
      remember(await deleteContribution(projectId, contribution.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSaveReport(draft) {
    setReportError('');
    const body = {
      body: draft.body,
      created_at: draft.created_at,
      flag: draft.flag,
    };
    try {
      if (draft.id) await updateStatusReport(projectId, draft.id, body);
      else await createStatusReport(projectId, body);
      await refreshReports(draft.id ? reportPage : 1);
    } catch (err) {
      setReportError(err.message);
      throw err;
    }
  }

  async function onDeleteReport(reportId) {
    setReportError('');
    try {
      await deleteStatusReport(projectId, reportId);
      const pageCount = Math.max(1, Math.ceil((reportTotal - 1) / REPORT_PAGE_SIZE));
      await refreshReports(Math.min(reportPage, pageCount));
    } catch (err) {
      setReportError(err.message);
      throw err;
    }
  }

  if (loading && !project) return <p className="muted">Loading…</p>;
  if (!project || !form) return <p className="banner" role="alert">{error || 'Project not found'}</p>;

  const assignedIds = new Set(project.assignments.map((row) => row.resource_id));
  const assignedLabelIds = new Set(project.tags.map((tag) => tag.id));
  const availableLabels = labels.filter((item) => !assignedLabelIds.has(item.id));
  const assignedGroupIds = new Set(project.groups.map((group) => group.id));
  const availableGroups = groups.filter((item) => !assignedGroupIds.has(item.id));

  function addPickedLabel(id) {
    const item = availableLabels.find((label) => String(label.id) === String(id));
    if (item) onToggleLabel(item.name);
  }

  function addPickedView(id) {
    const item = availableGroups.find((group) => String(group.id) === String(id));
    if (item) onToggleGroup(item.id);
  }

  return (
    <>
      <header className="main-header">
        <div>
          <button type="button" className="link link--back" onClick={onClose}>
            {project.archived ? 'Archive' : 'Projects'}
          </button>
          <h1>{project.name}</h1>
        </div>
        {canEdit ? (
          <div className="header-actions">
            {project.status === 'completed' && !project.archived ? (
              <button type="button" className="btn btn--secondary" onClick={onArchive}>Archive</button>
            ) : null}
            <button type="button" className="btn btn--danger" onClick={onDelete}>Delete project</button>
          </div>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      <section className="panel project-details">
        <header className="project-details__head">
          <h2>Project details</h2>
          {canEdit ? <p className="muted">Changes save when you leave a field.</p> : null}
        </header>
        <div className="project-details__meta">
          <label>
            Name
            <input
              value={form.name}
              disabled={!canEdit}
              onChange={(event) => {
                const name = event.target.value;
                draftRef.current = { ...draftRef.current, name };
                setForm((current) => ({ ...current, name }));
              }}
              onBlur={commitName}
            />
          </label>
          <label>
            Status
            <select value={project.status} disabled={!canEdit} onChange={(event) => onStatus(event.target.value)}>
              {lifecycle.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Report cadence (days)
            <input
              value={form.cadence}
              disabled={!canEdit}
              inputMode="numeric"
              placeholder="None"
              onChange={(event) => {
                const cadence = event.target.value;
                draftRef.current = { ...draftRef.current, cadence };
                setForm((current) => ({ ...current, cadence }));
              }}
              onBlur={commitCadence}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={project.reports_with_pmo}
              disabled={!canEdit}
              onChange={(event) => onPmo(event.target.checked)}
            />
            Reporting with PMO
          </label>
        </div>
        <div className="project-details__fields">
          <label>
            Description
            <textarea
              rows={5}
              placeholder="What this project covers"
              value={form.description}
              disabled={!canEdit}
              onChange={(event) => {
                const description = event.target.value;
                draftRef.current = { ...draftRef.current, description };
                setForm((current) => ({ ...current, description }));
              }}
              onBlur={commitDescription}
            />
          </label>
        </div>
      </section>

      <div className="split-panels">
        <section className="panel">
          {groups.length === 0 ? <p className="muted">No views yet. Create one from the projects list.</p> : (
            <>
              {project.groups.length > 0 ? (
                <ul className="label-list">
                  {project.groups.map((group) => (
                    <li key={group.id} className="label-chip">
                      {group.name}
                      {canEdit ? (
                        <button
                          type="button"
                          className="label-chip__remove"
                          aria-label={`Remove ${group.name}`}
                          onClick={() => onToggleGroup(group.id)}
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (!canEdit || availableGroups.length === 0) ? <p className="muted">Not in a view</p> : null}
              {canEdit ? (
                availableGroups.length > 0 ? (
                  <div className="label-picker">
                    <select
                      aria-label="Views"
                      value=""
                      onChange={(event) => addPickedView(event.target.value)}
                    >
                      <option value="">Choose a view</option>
                      {availableGroups.map((item) => (
                        <option key={item.id} value={item.id} title={item.description || undefined}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : <p className="muted">Every view already includes this project.</p>
              ) : null}
            </>
          )}
        </section>
        <section className="panel">
          {labels.length === 0 ? <p className="muted">No labels yet. Add them on the Labels page.</p> : (
            <>
              {project.tags.length > 0 ? (
                <ul className="label-list">
                  {project.tags.map((tag) => (
                    <li key={tag.id} className="label-chip" title={tag.title}>
                      {tag.name}
                      {canEdit ? (
                        <button
                          type="button"
                          className="label-chip__remove"
                          aria-label={`Remove ${tag.name}`}
                          onClick={() => onToggleLabel(tag.name)}
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (!canEdit || availableLabels.length === 0) ? <p className="muted">No labels</p> : null}
              {canEdit ? (
                availableLabels.length > 0 ? (
                  <div className="label-picker">
                    <select
                      aria-label="Labels"
                      value=""
                      onChange={(event) => addPickedLabel(event.target.value)}
                    >
                      <option value="">Choose a label</option>
                      {availableLabels.map((item) => (
                        <option key={item.id} value={item.id} title={item.title}>
                          {item.name} — {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : <p className="muted">Every label is already on this project.</p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <FoldSection
        title="People"
        count={project.assignments.length}
        actionLabel={canEdit ? 'Add person' : undefined}
        onAction={() => { setAssignError(''); setAdding(true); }}
        empty="No one is assigned yet."
      >
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Utilization</th>
              <th>Project role</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {project.assignments.map((row) => (
              <tr key={row.resource_id}>
                <td>{row.name}</td>
                <td>{row.department_name}</td>
                <td>
                  {canEdit ? (
                    <input
                      className="util-input"
                      key={`${row.resource_id}-${row.utilization_percent}`}
                      defaultValue={row.utilization_percent}
                      inputMode="numeric"
                      aria-label={`Utilization for ${row.name}`}
                      onBlur={(event) => onUtilization(row, event.target.value)}
                    />
                  ) : `${row.utilization_percent}%`}
                </td>
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
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => { setRemoveError(''); setRemoving(row); }}>
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </FoldSection>

      <FoldSection
        title="Past contributions"
        count={project.contributions.length}
        empty="No past contributions."
      >
        <ul className="past-contributions">
          {project.contributions.map((item) => (
            <li key={item.id} className="past-contributions__item">
              <div>
                <strong>{item.name}</strong>
                <span className="muted">
                  {' '}
                  {utcDay(item.started_at)} – {utcDay(item.ended_at)}
                  {' · '}
                  {roleLabel(item.project_role)}
                  {' · '}
                  {item.utilization_percent}%
                </span>
                {item.highlights ? <p className="muted">{item.highlights}</p> : null}
              </div>
              {canEdit ? (
                <div className="row-actions">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setContributionError(''); setEditingContribution(item); }}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => onDeleteContribution(item)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </FoldSection>

      <h2 className="section-title">Reports</h2>
      <ProjectReports
        reports={reports}
        latestReportAt={latestReportAt}
        total={reportTotal}
        page={reportPage}
        pageSize={REPORT_PAGE_SIZE}
        busy={reportBusy}
        error={reportError}
        onSave={canEdit ? onSaveReport : undefined}
        onDelete={canEdit ? onDeleteReport : undefined}
        onPageChange={(page) => refreshReports(page)}
        onDirtyChange={(dirty) => {
          reportDirtyRef.current = Boolean(dirty);
        }}
      />

      {adding ? (
        <AssignResourceForm
          projectName={project.name}
          people={people}
          roles={roles}
          assignedIds={assignedIds}
          busy={assignBusy}
          error={assignError}
          onCancel={() => { if (!assignBusy) setAdding(false); }}
          onSubmit={onAssign}
        />
      ) : null}
      {removing ? (
        <RemoveResourceDialog
          assignment={removing}
          projectName={project.name}
          busy={removeBusy}
          error={removeError}
          onCancel={() => { if (!removeBusy) setRemoving(null); }}
          onConfirm={onRemoveConfirm}
        />
      ) : null}
      {editingContribution ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (!contributionBusy && event.target === event.currentTarget) setEditingContribution(null);
        }}>
          <form className="modal" onSubmit={onSaveContribution}>
            <div className="modal__header">
              <h2>Edit {editingContribution.name}</h2>
              <button type="button" className="icon-btn" onClick={() => setEditingContribution(null)} disabled={contributionBusy} aria-label="Close">×</button>
            </div>
            <div className="modal__form">
              <div className="remove-dates">
                <label>
                  From
                  <input name="from" type="date" defaultValue={utcDay(editingContribution.started_at)} required />
                </label>
                <label>
                  To
                  <input name="to" type="date" defaultValue={utcDay(editingContribution.ended_at)} required />
                </label>
              </div>
              <label>
                Utilization %
                <input name="utilization" defaultValue={editingContribution.utilization_percent} inputMode="numeric" />
              </label>
              <label>
                Project role
                <select name="role" defaultValue={editingContribution.project_role}>
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Highlights
                <textarea name="highlights" rows={3} defaultValue={editingContribution.highlights || ''} />
              </label>
              {contributionError ? <p className="modal__error" role="alert">{contributionError}</p> : null}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setEditingContribution(null)} disabled={contributionBusy}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={contributionBusy}>{contributionBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      ) : null}
      {leavePrompt ? (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
            <div className="modal__header">
              <h2 id="unsaved-changes-title">Unsaved changes</h2>
            </div>
            <p className="modal__hint">Leave this project without saving the open edits?</p>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => { leavePrompt.resolve(false); setLeavePrompt(null); }}>Stay</button>
              <button type="button" className="btn btn--primary" onClick={() => { leavePrompt.resolve(true); setLeavePrompt(null); }}>Leave</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
