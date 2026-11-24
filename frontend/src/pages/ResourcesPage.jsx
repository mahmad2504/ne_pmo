import { useEffect, useRef, useState } from 'react';
import CompanyLabel from '../components/CompanyLabel.jsx';
import {
  deleteResource,
  listCompanies,
  listDepartments,
  listDesignations,
  listLocations,
  listResources,
} from '../api.js';
import ResourceFormDialog from './ResourceFormDialog.jsx';

function projectCountLabel(count) {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}

function peopleLabel(count) {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

function DepartmentSummary({ departments, counts, selectedId, resignedOnly, onSelect }) {
  const items = departments
    .map((department) => ({
      id: department.id,
      name: department.name,
      count: counts[department.id] || 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section
      className="dept-summary"
      aria-label={resignedOnly ? 'Resigned people by department' : 'People by department'}
    >
      <button
        type="button"
        className={`dept-summary__item${selectedId === '' ? ' dept-summary__item--active' : ''}`}
        aria-pressed={selectedId === ''}
        onClick={() => onSelect('')}
      >
        <span className="dept-summary__count">{total}</span>
        <span className="dept-summary__name">All departments</span>
      </button>
      {items.map((item) => {
        const selected = selectedId === String(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`dept-summary__item${selected ? ' dept-summary__item--active' : ''}`}
            aria-pressed={selected}
            aria-label={`${item.name}, ${peopleLabel(item.count)}`}
            onClick={() => onSelect(selected ? '' : String(item.id))}
          >
            <span className="dept-summary__count">{item.count}</span>
            <span className="dept-summary__name">{item.name}</span>
          </button>
        );
      })}
    </section>
  );
}

export default function ResourcesPage({ canEdit, onOpenProjects, resignedOnly = false }) {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [location, setLocation] = useState('');
  const [projectCount, setProjectCount] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [departmentCounts, setDepartmentCounts] = useState(null);
  const requestId = useRef(0);
  const summaryRequest = useRef(0);
  const copiedTimer = useRef(null);

  async function refresh(next = {}) {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const people = await listResources({
        q: next.q ?? q,
        department_id: next.departmentId ?? departmentId,
        company_id: next.companyId ?? companyId,
        location: next.location ?? location,
        resigned_only: resignedOnly,
        project_count: next.projectCount ?? projectCount,
      });
      if (id !== requestId.current) return;
      setRows(people);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function loadSummary() {
    const id = ++summaryRequest.current;
    try {
      const people = await listResources({ resigned_only: resignedOnly });
      if (id !== summaryRequest.current) return;
      const counts = {};
      for (const person of people) {
        const deptId = person.department?.id;
        if (deptId == null) continue;
        counts[deptId] = (counts[deptId] || 0) + 1;
      }
      setDepartmentCounts(counts);
    } catch (err) {
      if (id !== summaryRequest.current) return;
      setError(err.message);
    }
  }

  function applyDepartment(value) {
    setDepartmentId(value);
    refresh({ departmentId: value });
  }

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listDepartments(), listDesignations(), listCompanies(), listLocations()])
      .then(([departmentRows, titleRows, companyRows, locationRows]) => {
        if (!active) return;
        setDepartments(departmentRows);
        setTitles(titleRows);
        setCompanies(companyRows);
        setLocations(locationRows);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    refresh();
    loadSummary();
    return () => {
      active = false;
    };
  }, []);

  function closeForm() {
    setFormOpen(false);
    setEditingPerson(null);
  }

  function beginCreate() {
    setEditingPerson(null);
    setFormOpen(true);
    setError('');
  }

  function beginEdit(row) {
    setEditingPerson(row);
    setFormOpen(true);
    setError('');
  }

  async function onPersonSaved() {
    await Promise.all([refresh(), loadSummary()]);
  }

  async function copyEmail(row) {
    setError('');
    try {
      await navigator.clipboard.writeText(row.email);
      setCopiedId(row.id);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      setError(err.message || 'Could not copy email.');
    }
  }

  async function onDelete(row) {
    if (!window.confirm(`Delete ${row.name}? Their project assignments will be removed.`)) return;
    setError('');
    try {
      await deleteResource(row.id);
      if (formOpen && editingPerson?.id === row.id) closeForm();
      await Promise.all([refresh(), loadSummary()]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="resources-page">
      <header className="main-header">
        <div>
          <h1>{resignedOnly ? 'Resigned' : 'Resources'}</h1>
          <p className="subtitle">{resignedOnly
            ? 'People who have left, with the same department, job title, and project history.'
            : 'People in the directory, with a department, job title, email, location, and the companies they are onboarded with.'}</p>
        </div>
        {canEdit && !resignedOnly ? (
          <button type="button" className="btn btn--primary" onClick={beginCreate} disabled={departments.length === 0}>
            Add person
          </button>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {departments.length > 0 && departmentCounts ? (
        <DepartmentSummary
          departments={departments}
          counts={departmentCounts}
          selectedId={departmentId}
          resignedOnly={resignedOnly}
          onSelect={applyDepartment}
        />
      ) : null}
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only">Search</span>
          <input
            value={q}
            placeholder="Search name or email"
            onChange={(event) => {
              const value = event.target.value;
              setQ(value);
              refresh({ q: value });
            }}
          />
        </label>
        <label>
          Department
          <select
            value={departmentId}
            onChange={(event) => applyDepartment(event.target.value)}
          >
            <option value="">All</option>
            {departments.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label>
          Onboarded
          <select
            value={companyId}
            onChange={(event) => {
              const value = event.target.value;
              setCompanyId(value);
              refresh({ companyId: value });
            }}
          >
            <option value="">All</option>
            {companies.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select
            value={location}
            onChange={(event) => {
              const value = event.target.value;
              setLocation(value);
              refresh({ location: value });
            }}
          >
            <option value="">All</option>
            {locations.map((row) => (
              <option key={row.code} value={row.code}>{row.label}</option>
            ))}
          </select>
        </label>
        <label>
          Projects
          <select
            value={projectCount}
            onChange={(event) => {
              const value = event.target.value;
              setProjectCount(value);
              refresh({ projectCount: value });
            }}
          >
            <option value="">All</option>
            <option value="single">Single</option>
            <option value="multiple">Multiple</option>
            <option value="none">No projects</option>
          </select>
        </label>
      </div>
      {canEdit && !resignedOnly && departments.length === 0 ? (
        <p className="empty">Add a department before adding a person.</p>
      ) : null}
      {canEdit && formOpen ? (
        <ResourceFormDialog
          key={editingPerson?.id ?? 'new'}
          person={editingPerson}
          departments={departments}
          titles={titles}
          companies={companies}
          locations={locations}
          onClose={closeForm}
          onSaved={onPersonSaved}
        />
      ) : null}
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">No people match.</p>
      ) : (
        <table className="data resources-table">
          <colgroup>
            <col className="resources-table__name" />
            <col className="resources-table__department" />
            <col className="resources-table__title" />
            <col className="resources-table__companies" />
            <col className="resources-table__location" />
            <col className="resources-table__projects" />
            <col className="resources-table__actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Job title</th>
              <th>Onboarded</th>
              <th>Location</th>
              <th>Projects</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="clip-cell">
                  <span className="name-cell">
                    <span className="clip" title={row.name}>{row.name}</span>
                    {row.resigned && !resignedOnly ? <span className="flag">Resigned</span> : null}
                  </span>
                </td>
                <td>{row.department.name}</td>
                <td className="clip-cell">{row.designation?.name
                  ? <span className="clip" title={row.designation.name}>{row.designation.name}</span>
                  : <span className="muted">—</span>}</td>
                <td className="companies-cell">{row.companies.length ? row.companies.map((company) => (
                  <CompanyLabel key={company.id} name={company.name} icon={company.icon} iconOnly />
                )) : <span className="muted">—</span>}</td>
                <td>{row.location || <span className="muted">—</span>}</td>
                <td>
                  {row.assignments.length === 0 ? <span className="muted">—</span> : (
                    <button
                      type="button"
                      className="project-count"
                      title={projectCountLabel(row.assignments.length)}
                      aria-label={projectCountLabel(row.assignments.length)}
                      onClick={() => onOpenProjects(row.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          fillRule="evenodd"
                          d="M9.75 3a2.25 2.25 0 0 0-2.25 2.25V6H3.75A2.25 2.25 0 0 0 1.5 8.25v9A2.25 2.25 0 0 0 3.75 19.5h16.5a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 20.25 6h-3.75v-.75A2.25 2.25 0 0 0 14.25 3h-4.5Zm0 2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75V6h-6v-.75Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{row.assignments.length}</span>
                    </button>
                  )}
                </td>
                <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      title={copiedId === row.id ? 'Copied' : `Copy ${row.email}`}
                      aria-label={copiedId === row.id ? `Copied ${row.email}` : `Copy ${row.email}`}
                      onClick={() => copyEmail(row)}
                    >
                      {copiedId === row.id ? 'Copied' : (
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                          <rect x="5" y="1.5" width="8.5" height="10.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="2.5" y="4" width="8.5" height="10.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      )}
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          title="Edit"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => beginEdit(row)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                            <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="m13.5 6.5 3 3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--icon"
                          title="Delete"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => onDelete(row)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
