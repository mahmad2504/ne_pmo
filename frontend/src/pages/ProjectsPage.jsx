import { useEffect, useRef, useState } from 'react';
import {
  archiveProject,
  createProject,
  createProjectGroup,
  createAllSection,
  createProjectSection,
  deleteAllSection,
  deleteProjectSection,
  getProject,
  getResource,
  listAllSections,
  listLifecycle,
  listProjectSections,
  listProjects,
  listTags,
  setAllSection,
  setProjectSection,
  updateProjectSection,
} from '../api.js';
import ProjectUsersDialog, { UsersButton } from './ProjectUsersDialog.jsx';

const emptyForm = {
  name: '',
  description: '',
  status: 'assessment',
  group_ids: [],
  cadence: '7',
  reports_with_pmo: true,
  externalUrl: '',
  tags: [],
};
const emptyView = { name: '', description: '' };
const emptySection = { name: '', id: null };

function sectionIdOf(row, viewId, knownIds) {
  const membership = (row.groups || []).find((item) => item.id === viewId);
  const sectionId = membership?.section_id ?? null;
  if (sectionId == null || (knownIds && !knownIds.has(sectionId))) return null;
  return sectionId;
}

function withSection(row, viewId, section) {
  return {
    ...row,
    groups: (row.groups || []).map((item) => (
      item.id === viewId
        ? { ...item, section_id: section ? section.id : null, section_name: section ? section.name : null }
        : item
    )),
  };
}

function placedSectionId(row, viewId, knownIds) {
  if (viewId) return sectionIdOf(row, viewId, knownIds);
  const sectionId = row.section_id ?? null;
  if (sectionId == null || (knownIds && !knownIds.has(sectionId))) return null;
  return sectionId;
}

function withPlacement(row, viewId, section) {
  if (viewId) return withSection(row, viewId, section);
  return {
    ...row,
    section_id: section ? section.id : null,
    section_name: section ? section.name : null,
  };
}

function DragHandle({ name, onDragStart, onDragEnd }) {
  return (
    <div
      className="drag-handle"
      role="button"
      tabIndex={0}
      draggable
      aria-label={`Move ${name}`}
      title="Drag to a section"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="9" cy="6" r="1.4" fill="currentColor" />
        <circle cx="15" cy="6" r="1.4" fill="currentColor" />
        <circle cx="9" cy="12" r="1.4" fill="currentColor" />
        <circle cx="15" cy="12" r="1.4" fill="currentColor" />
        <circle cx="9" cy="18" r="1.4" fill="currentColor" />
        <circle cx="15" cy="18" r="1.4" fill="currentColor" />
      </svg>
    </div>
  );
}

function SectionGroup({
  section,
  title,
  rows,
  columnCount,
  canEdit,
  dropOver,
  onDragOver,
  onDrop,
  onRename,
  onDelete,
  renderProject,
}) {
  return (
    <>
      <SectionBand
        title={title || section.name}
        columnCount={columnCount}
        dropOver={dropOver}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onRename={canEdit && section ? onRename : null}
        onDelete={canEdit && section ? onDelete : null}
      />
      {rows.map((row) => renderProject(row))}
    </>
  );
}

function SectionBand({ title, columnCount, dropOver, onDragOver, onDrop, onRename, onDelete }) {
  return (
    <tr
      className={dropOver ? 'section-band section-band--over' : 'section-band'}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <th className="section-band" colSpan={columnCount} scope="rowgroup">
        <div className="section-band__bar">
          <span className="section-band__name">{title}</span>
          {onRename || onDelete ? (
            <span className="section-band__actions">
              {onRename ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onRename}>Rename</button>
              ) : null}
              {onDelete ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onDelete}>Delete</button>
              ) : null}
            </span>
          ) : null}
        </div>
      </th>
    </tr>
  );
}

function parseCadence(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed) || Number(trimmed) > 365) {
    return { error: 'Report cadence must be a whole number from 0 to 365, or blank for none.' };
  }
  return { value: Number(trimmed) };
}

function parseExternalUrl(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { value: null };
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:/i.test(trimmed)) {
    return { error: 'External link must be an http or https address.' };
  }
  return { value: trimmed };
}

function ViewPicker({ groups, selectedIds, onToggle }) {
  const selected = new Set(selectedIds);
  const chosen = groups.filter((item) => selected.has(item.id));
  const available = groups.filter((item) => !selected.has(item.id));

  return (
    <div className="project-details__choice">
      <span className="project-details__caption">Views</span>
      {groups.length === 0 ? <p className="muted">No views yet. Create one from the projects list.</p> : (
        <>
          {available.length > 0 ? (
            <div className="label-picker">
              <select
                aria-label="Views"
                value=""
                onChange={(event) => {
                  const item = available.find((group) => String(group.id) === event.target.value);
                  if (item) onToggle(item.id);
                }}
              >
                <option value="">Choose a view</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id} title={item.description || undefined}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : <p className="project-details__note">Every view already includes this project.</p>}
          {chosen.length > 0 ? (
            <ul className="label-list">
              {chosen.map((group) => (
                <li key={group.id} className="label-chip">
                  {group.name}
                  <button
                    type="button"
                    className="label-chip__remove"
                    aria-label={`Remove ${group.name}`}
                    onClick={() => onToggle(group.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : available.length === 0 ? <p className="muted">Not in a view</p> : null}
        </>
      )}
    </div>
  );
}

function LabelPicker({ labels, selectedNames, onToggle }) {
  const selected = new Set(selectedNames.map((name) => name.toLowerCase()));
  const chosen = labels.filter((item) => selected.has(item.name.toLowerCase()));
  const available = labels.filter((item) => !selected.has(item.name.toLowerCase()));

  return (
    <div className="project-details__choice">
      <span className="project-details__caption">Labels</span>
      {labels.length === 0 ? <p className="muted">No labels yet. Add them on the Labels page.</p> : (
        <>
          {available.length > 0 ? (
            <div className="label-picker">
              <select
                aria-label="Labels"
                value=""
                onChange={(event) => {
                  const item = available.find((label) => String(label.id) === event.target.value);
                  if (item) onToggle(item.name);
                }}
              >
                <option value="">Choose a label</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id} title={item.title}>
                    {item.name} — {item.title}
                  </option>
                ))}
              </select>
            </div>
          ) : <p className="project-details__note">Every label is already on this project.</p>}
          {chosen.length > 0 ? (
            <ul className="label-list">
              {chosen.map((tag) => (
                <li key={tag.id} className="label-chip" title={tag.title}>
                  {tag.name}
                  <button
                    type="button"
                    className="label-chip__remove"
                    aria-label={`Remove ${tag.name}`}
                    onClick={() => onToggle(tag.name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : available.length === 0 ? <p className="muted">No labels</p> : null}
        </>
      )}
    </div>
  );
}

function ProjectRow({ row, canEdit, canArrange, labelFor, onOpen, onOpenUsers, onArchive, onDragStart, onDragEnd }) {
  return (
    <tr>
      {canArrange ? (
        <td className="drag-col">
          <DragHandle
            name={row.name}
            onDragStart={(event) => onDragStart(event, row.id)}
            onDragEnd={onDragEnd}
          />
        </td>
      ) : null}
      <td>
        <button type="button" className="link project-name" onClick={() => onOpen(row.id)}>{row.name}</button>
      </td>
      <td className="desc-cell" title={row.description || undefined}>
        {row.description ? <div className="desc-clamp">{row.description}</div> : <span className="muted">—</span>}
      </td>
      <td className="views-cell">
        {row.groups?.length > 0 ? (
          <ul className="label-list">
            {row.groups.map((group) => (
              <li key={group.id} className="label-chip label-chip--static">{group.name}</li>
            ))}
          </ul>
        ) : <span className="muted">—</span>}
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
      <td className="people-col">
        <UsersButton count={row.resource_count ?? row.assignment_count} onClick={() => onOpenUsers(row)} />
      </td>
      <td className="status-col">
        <span className="status-label">
          <span className={`status-text status-text--${row.status}`}>{labelFor(row.status)}</span>
          {row.archived ? <span className="flag">Archived</span> : null}
        </span>
      </td>
      {canEdit ? (
        <td className="archive-col">
          {row.status === 'completed' && !row.archived ? (
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
      ) : null}
    </tr>
  );
}

export default function ProjectsPage({ canEdit, group, groups, resourceId, onSelectGroup, onEditView, onOpenProject, onClearResource, onGroupsChanged }) {
  const [rows, setRows] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [labels, setLabels] = useState([]);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [viewForm, setViewForm] = useState(emptyView);
  const [showForm, setShowForm] = useState(false);
  const [showViewForm, setShowViewForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [viewFormError, setViewFormError] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionForm, setSectionForm] = useState(emptySection);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionFormError, setSectionFormError] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersProject, setUsersProject] = useState(null);
  const [person, setPerson] = useState(null);
  const requestId = useRef(0);
  const dialogRef = useRef(null);
  const closingRef = useRef(false);
  const viewDialogRef = useRef(null);
  const viewClosingRef = useRef(false);
  const sectionDialogRef = useRef(null);
  const sectionClosingRef = useRef(false);
  const seenFilters = useRef({ q: '', group: undefined, resourceId: undefined });
  const openGroupId = group && /^\d+$/.test(group) ? Number(group) : null;
  const openGroup = groups.find((item) => item.id === openGroupId) || null;
  const allMode = !resourceId && !group;

  function labelFor(code) {
    return lifecycle.find((item) => item.code === code)?.label || code;
  }

  function listParams() {
    if (resourceId) return { resourceId };
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
    listTags().then(setLabels).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const previous = seenFilters.current;
    const first = previous.group === undefined && previous.resourceId === undefined;
    const groupChanged = previous.group !== group;
    const resourceChanged = previous.resourceId !== resourceId;
    seenFilters.current = { q, group, resourceId };
    const delay = first || groupChanged || resourceChanged ? 0 : 300;
    const timer = window.setTimeout(() => {
      refresh(q);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [q, group, resourceId]);

  useEffect(() => {
    if (!resourceId) {
      setPerson(null);
      return undefined;
    }
    let active = true;
    getResource(resourceId)
      .then((row) => {
        if (active) setPerson(row);
      })
      .catch((err) => {
        if (active) {
          setPerson(null);
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [resourceId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showForm && !dialog.open) {
      dialog.showModal();
    } else if (!showForm && dialog.open) {
      closingRef.current = true;
      dialog.close();
      closingRef.current = false;
    }
  }, [showForm]);

  useEffect(() => {
    const dialog = viewDialogRef.current;
    if (!dialog) return;
    if (showViewForm && !dialog.open) {
      dialog.showModal();
    } else if (!showViewForm && dialog.open) {
      viewClosingRef.current = true;
      dialog.close();
      viewClosingRef.current = false;
    }
  }, [showViewForm]);

  useEffect(() => {
    if (!openGroupId && !allMode) {
      setSections([]);
      return undefined;
    }
    let active = true;
    setSections([]);
    const request = openGroupId ? listProjectSections(openGroupId) : listAllSections();
    request
      .then((next) => {
        if (active) setSections(next);
      })
      .catch((err) => {
        if (!active) return;
        setSections([]);
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [openGroupId, allMode]);

  useEffect(() => {
    const dialog = sectionDialogRef.current;
    if (!dialog) return;
    if (showSectionForm && !dialog.open) {
      dialog.showModal();
    } else if (!showSectionForm && dialog.open) {
      sectionClosingRef.current = true;
      dialog.close();
      sectionClosingRef.current = false;
    }
  }, [showSectionForm]);

  function closeProjectForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
  }

  function openProjectForm() {
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function onDialogCancel(event) {
    event.preventDefault();
  }

  function onDialogClose() {
    if (closingRef.current) return;
    closeProjectForm();
  }

  function closeViewForm() {
    setShowViewForm(false);
    setViewForm(emptyView);
    setViewFormError('');
  }

  function openViewForm() {
    setViewForm(emptyView);
    setViewFormError('');
    setShowViewForm(true);
  }

  function openEditView() {
    if (!openGroup) return;
    onEditView(openGroup.id);
  }

  function closeSectionForm() {
    setShowSectionForm(false);
    setSectionForm(emptySection);
    setSectionFormError('');
  }

  function openSectionForm(section = null) {
    setSectionForm({ name: section?.name || '', id: section?.id || null });
    setSectionFormError('');
    setShowSectionForm(true);
  }

  function onSectionDialogCancel(event) {
    event.preventDefault();
    closeSectionForm();
  }

  function onSectionDialogClose() {
    if (sectionClosingRef.current) return;
    closeSectionForm();
  }

  async function onSaveSection(event) {
    event.preventDefault();
    if (!openGroupId && !allMode) return;
    setSectionFormError('');
    try {
      if (sectionForm.id) {
        const updated = openGroupId
          ? await updateProjectSection(openGroupId, sectionForm.id, { name: sectionForm.name })
          : await updateAllSection(sectionForm.id, { name: sectionForm.name });
        setSections((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setRows((current) => current.map((row) => (
          placedSectionId(row, openGroupId) === updated.id ? withPlacement(row, openGroupId, updated) : row
        )));
      } else {
        const created = openGroupId
          ? await createProjectSection(openGroupId, { name: sectionForm.name })
          : await createAllSection({ name: sectionForm.name });
        setSections((current) => [...current, created]);
      }
      closeSectionForm();
    } catch (err) {
      setSectionFormError(err.message);
    }
  }

  async function onDeleteSection(section) {
    if (!openGroupId && !allMode) return;
    const kept = openGroupId ? 'this view' : 'this list';
    if (!window.confirm(`Delete the ${section.name} section? Projects in it stay in ${kept}.`)) return;
    setError('');
    try {
      if (openGroupId) await deleteProjectSection(openGroupId, section.id);
      else await deleteAllSection(section.id);
      setSections((current) => current.filter((item) => item.id !== section.id));
      setRows((current) => current.map((row) => (
        placedSectionId(row, openGroupId) === section.id ? withPlacement(row, openGroupId, null) : row
      )));
    } catch (err) {
      setError(err.message);
    }
  }

  function onDragStartProject(event, projectId) {
    event.dataTransfer.setData('text/plain', String(projectId));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(projectId);
  }

  function onDragEndProject() {
    setDraggingId(null);
    setDropKey(null);
  }

  function onDragOverSection(event, key) {
    if (draggingId == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropKey((current) => (current === key ? current : key));
  }

  async function onDropProject(event, sectionId) {
    event.preventDefault();
    const projectId = draggingId;
    setDropKey(null);
    setDraggingId(null);
    if ((!openGroupId && !allMode) || projectId == null) return;
    const row = rows.find((item) => item.id === projectId);
    if (!row) return;
    const knownIds = new Set(sections.map((item) => item.id));
    const currentId = placedSectionId(row, openGroupId, knownIds);
    if (currentId === sectionId) return;
    const section = sectionId == null ? null : sections.find((item) => item.id === sectionId) || null;
    if (sectionId != null && !section) return;
    const previous = rows;
    setRows((current) => current.map((item) => (
      item.id === projectId ? withPlacement(item, openGroupId, section) : item
    )));
    try {
      if (openGroupId) await setProjectSection(projectId, openGroupId, sectionId);
      else await setAllSection(projectId, sectionId);
    } catch (err) {
      setRows(previous);
      setError(err.message);
    }
  }

  function onViewDialogCancel(event) {
    event.preventDefault();
    closeViewForm();
  }

  function onViewDialogClose() {
    if (viewClosingRef.current) return;
    closeViewForm();
  }

  function onToggleFormGroup(groupId) {
    setForm((current) => {
      const selected = current.group_ids.includes(groupId);
      return {
        ...current,
        group_ids: selected
          ? current.group_ids.filter((id) => id !== groupId)
          : [...current.group_ids, groupId],
      };
    });
  }

  function onToggleLabel(name) {
    setForm((current) => {
      const selected = current.tags.some((item) => item.toLowerCase() === name.toLowerCase());
      return {
        ...current,
        tags: selected
          ? current.tags.filter((item) => item.toLowerCase() !== name.toLowerCase())
          : [...current.tags, name],
      };
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFormError('');
    const parsed = parseCadence(form.cadence);
    if (parsed.error) {
      setFormError(parsed.error);
      return;
    }
    const external = parseExternalUrl(form.externalUrl);
    if (external.error) {
      setFormError(external.error);
      return;
    }
    let groupIds = form.group_ids;
    if (openGroup && !resourceId && !groupIds.includes(openGroup.id)) {
      const projectName = form.name.trim() || 'this project';
      if (window.confirm(`Add "${projectName}" to the "${openGroup.name}" view?`)) {
        groupIds = [...groupIds, openGroup.id];
      }
    }
    try {
      const created = await createProject({
        name: form.name,
        description: form.description,
        status: form.status,
        group_ids: groupIds,
        report_cadence_days: parsed.value,
        reports_with_pmo: form.reports_with_pmo,
        external_url: external.value,
        tags: form.tags,
      });
      setShowForm(false);
      setForm(emptyForm);
      setFormError('');
      onOpenProject(created.id);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onSaveView(event) {
    event.preventDefault();
    setViewFormError('');
    try {
      const created = await createProjectGroup({ name: viewForm.name, description: viewForm.description });
      setShowViewForm(false);
      setViewForm(emptyView);
      setViewFormError('');
      await onGroupsChanged();
      onSelectGroup(String(created.id));
    } catch (err) {
      setViewFormError(err.message);
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

  const emptyLabel = appliedQ
    ? 'No projects match.'
    : resourceId
      ? 'No projects for this person.'
      : openGroup
        ? 'No projects in this view.'
        : group === 'none'
          ? 'Every project is in a view.'
          : 'No projects yet.';

  const grouped = Boolean((openGroupId || allMode) && sections.length > 0);
  const canArrange = Boolean(canEdit && grouped && !appliedQ);
  const knownSectionIds = new Set(sections.map((item) => item.id));
  const looseRows = grouped
    ? rows.filter((row) => placedSectionId(row, openGroupId, knownSectionIds) == null)
    : [];
  const visibleSections = grouped
    ? sections.filter((section) => (
      !appliedQ || rows.some((row) => placedSectionId(row, openGroupId, knownSectionIds) === section.id)
    ))
    : [];
  const showLoose = grouped && (!appliedQ || looseRows.length > 0);
  const columnCount = 6 + (canEdit ? 1 : 0) + (canArrange ? 1 : 0);
  const showEmpty = !loading && rows.length === 0 && (!grouped || Boolean(appliedQ));

  function renderProject(row) {
    return (
      <ProjectRow
        key={row.id}
        row={row}
        canEdit={canEdit}
        canArrange={canArrange}
        labelFor={labelFor}
        onOpen={onOpenProject}
        onOpenUsers={openUsers}
        onArchive={onArchive}
        onDragStart={onDragStartProject}
        onDragEnd={onDragEndProject}
      />
    );
  }

  return (
    <>
      <header className="main-header">
        <div>
          {resourceId ? (
            <button type="button" className="link link--back" onClick={onClearResource}>All projects</button>
          ) : null}
          <h1>{resourceId && person ? person.name : 'Projects'}</h1>
          <p className="subtitle">{resourceId
            ? 'Projects this person is assigned to.'
            : 'Views filter this list. A project can sit in more than one view.'}</p>
        </div>
        {canEdit ? (
          <div className="header-actions">
            {openGroup || allMode ? (
              <>
                <button type="button" className="btn btn--secondary" onClick={() => openSectionForm()}>
                  New section
                </button>
                {openGroup ? (
                  <button type="button" className="btn btn--secondary" onClick={openEditView}>
                    Edit view
                  </button>
                ) : null}
              </>
            ) : null}
            <button type="button" className="btn btn--secondary" onClick={openViewForm}>
              New view
            </button>
            <button type="button" className="btn btn--primary" onClick={openProjectForm}>
              New project
            </button>
          </div>
        ) : null}
      </header>
      <nav className="view-bar" aria-label="Views">
        <button
          type="button"
          className={!group ? 'view-bar__item view-bar__item--active' : 'view-bar__item'}
          onClick={() => onSelectGroup(null)}
        >
          All
        </button>
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            className={String(item.id) === group ? 'view-bar__item view-bar__item--active' : 'view-bar__item'}
            onClick={() => onSelectGroup(String(item.id))}
          >
            {item.name}
          </button>
        ))}
        {groups.length === 0 ? <p className="view-bar__empty">No views yet</p> : null}
      </nav>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {openGroup?.description ? <p className="view-tools muted">{openGroup.description}</p> : null}
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
      {canEdit ? (
        <>
        <dialog
          ref={viewDialogRef}
          className="dialog"
          aria-labelledby="view-dialog-title"
          onCancel={onViewDialogCancel}
          onClose={onViewDialogClose}
        >
          <form className="form-grid dialog-fields" onSubmit={onSaveView}>
            <h2 id="view-dialog-title" className="dialog-heading">New view</h2>
            {viewFormError ? <p className="banner" role="alert">{viewFormError}</p> : null}
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
              <button type="button" className="btn btn--ghost" onClick={closeViewForm}>Cancel</button>
            </div>
          </form>
        </dialog>
        <dialog
          ref={sectionDialogRef}
          className="dialog"
          aria-labelledby="section-dialog-title"
          onCancel={onSectionDialogCancel}
          onClose={onSectionDialogClose}
        >
          <form className="form-grid dialog-fields" onSubmit={onSaveSection}>
            <h2 id="section-dialog-title" className="dialog-heading">
              {sectionForm.id ? 'Rename section' : 'New section'}
            </h2>
            {sectionFormError ? <p className="banner" role="alert">{sectionFormError}</p> : null}
            <label className="field-wide">
              Section name
              <input
                value={sectionForm.name}
                onChange={(event) => setSectionForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary">{sectionForm.id ? 'Save' : 'Create section'}</button>
              <button type="button" className="btn btn--ghost" onClick={closeSectionForm}>Cancel</button>
            </div>
          </form>
        </dialog>
        <dialog
          ref={dialogRef}
          className="dialog dialog--project"
          aria-labelledby="project-dialog-title"
          onCancel={onDialogCancel}
          onClose={onDialogClose}
        >
          <form className="project-details" onSubmit={onSubmit}>
            <h2 id="project-dialog-title" className="dialog-heading">New project</h2>
            {formError ? <p className="banner" role="alert">{formError}</p> : null}
            <div className="project-details__meta">
              <label>
                Name
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {lifecycle.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Report cadence (days)
                <input
                  value={form.cadence}
                  inputMode="numeric"
                  placeholder="None"
                  onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value }))}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={form.reports_with_pmo}
                  onChange={(event) => setForm((current) => ({ ...current, reports_with_pmo: event.target.checked }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label>
                External link
                <input
                  value={form.externalUrl}
                  placeholder="https://example.com"
                  onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
                />
              </label>
            </div>
            <div className="split-panels">
              <ViewPicker groups={groups} selectedIds={form.group_ids} onToggle={onToggleFormGroup} />
              <LabelPicker labels={labels} selectedNames={form.tags} onToggle={onToggleLabel} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary">Create</button>
              <button type="button" className="btn btn--ghost" onClick={closeProjectForm}>Cancel</button>
            </div>
          </form>
        </dialog>
        </>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : showEmpty ? (
        <p className="empty">{emptyLabel}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              {canArrange ? <th className="drag-col"><span className="sr-only">Move</span></th> : null}
              <th>Name</th>
              <th>Description</th>
              <th>Views</th>
              <th>Labels</th>
              <th className="people-col">People</th>
              <th className="status-col">Status</th>
              {canEdit ? <th className="archive-col"><span className="sr-only">Archive</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {grouped ? (
              <>
                {visibleSections.map((section) => (
                  <SectionGroup
                    key={section.id}
                    section={section}
                    rows={rows.filter((row) => placedSectionId(row, openGroupId, knownSectionIds) === section.id)}
                    columnCount={columnCount}
                    canEdit={canEdit}
                    dropOver={dropKey === section.id}
                    onDragOver={(event) => onDragOverSection(event, section.id)}
                    onDrop={(event) => onDropProject(event, section.id)}
                    onRename={() => openSectionForm(section)}
                    onDelete={() => onDeleteSection(section)}
                    renderProject={renderProject}
                  />
                ))}
                {showLoose ? (
                  <SectionGroup
                    title="No section"
                    rows={looseRows}
                    columnCount={columnCount}
                    dropOver={dropKey === 'none'}
                    onDragOver={(event) => onDragOverSection(event, 'none')}
                    onDrop={(event) => onDropProject(event, null)}
                    renderProject={renderProject}
                  />
                ) : null}
              </>
            ) : rows.map((row) => renderProject(row))}
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
