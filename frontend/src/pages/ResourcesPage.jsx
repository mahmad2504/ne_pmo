import { useEffect, useRef, useState } from 'react';
import CompanyLabel from '../components/CompanyLabel.jsx';
import {
  createResource,
  deleteResource,
  listCompanies,
  listDepartments,
  listDesignations,
  listLocations,
  listResources,
  updateResource,
} from '../api.js';

const emptyForm = {
  name: '',
  email: '',
  department_id: '',
  designation_id: '',
  location: '',
  company_ids: [],
};

export default function ResourcesPage({ canEdit, onOpenProject }) {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [location, setLocation] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const requestId = useRef(0);
  const copiedTimer = useRef(null);
  const dialogRef = useRef(null);
  const closingRef = useRef(false);

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

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

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
    return () => {
      active = false;
    };
  }, []);

  function beginCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      department_id: departments[0] ? String(departments[0].id) : '',
    });
    setShowForm(true);
    setError('');
    setFormError('');
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      email: row.email,
      department_id: String(row.department.id),
      designation_id: row.designation ? String(row.designation.id) : '',
      location: row.location || '',
      company_ids: row.companies.map((company) => company.id),
    });
    setShowForm(true);
    setError('');
    setFormError('');
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  function onDialogCancel(event) {
    event.preventDefault();
  }

  function onDialogClose() {
    if (closingRef.current) return;
    cancel();
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFormError('');
    const body = {
      name: form.name,
      email: form.email,
      department_id: Number(form.department_id),
      designation_id: form.designation_id ? Number(form.designation_id) : null,
      location: form.location || null,
      company_ids: form.company_ids,
    };
    try {
      if (editingId) await updateResource(editingId, body);
      else await createResource(body);
      cancel();
      await refresh();
    } catch (err) {
      setFormError(err.message);
    }
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
      if (editingId === row.id) cancel();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="main-header">
        <div>
          <h1>Resources</h1>
          <p className="subtitle">People in the directory, with a department, job title, email, location, and the companies they are onboarded with.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={beginCreate} disabled={departments.length === 0}>
            Add person
          </button>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
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
            onChange={(event) => {
              const value = event.target.value;
              setDepartmentId(value);
              refresh({ departmentId: value });
            }}
          >
            <option value="">All</option>
            {departments.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label>
          Onboarded with
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
      </div>
      {canEdit && departments.length === 0 ? (
        <p className="empty">Add a department before adding a person.</p>
      ) : null}
      {canEdit ? (
        <dialog
          ref={dialogRef}
          className="dialog"
          aria-labelledby="resource-dialog-title"
          onCancel={onDialogCancel}
          onClose={onDialogClose}
        >
          <form className="form-grid" onSubmit={onSubmit}>
            <h2 id="resource-dialog-title" className="dialog-heading">{editingId ? 'Edit person' : 'Add person'}</h2>
            {formError ? <p className="banner" role="alert">{formError}</p> : null}
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
            </label>
            <label>
              Department
              <select value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))} required>
                <option value="" disabled>Select</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              Job title
              <select value={form.designation_id} onChange={(event) => setForm((current) => ({ ...current, designation_id: event.target.value }))}>
                <option value="">None</option>
                {titles.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}>
                <option value="">Unset</option>
                {locations.map((row) => (
                  <option key={row.code} value={row.code}>{row.label}</option>
                ))}
              </select>
            </label>
            <fieldset className="check-group">
              <legend>Onboarded with</legend>
              {companies.length === 0 ? (
                <span className="muted">No companies yet.</span>
              ) : (
                <div className="check-list">
                  {companies.map((company) => (
                    <label key={company.id}>
                      <input
                        type="checkbox"
                        checked={form.company_ids.includes(company.id)}
                        onChange={() => {
                          setForm((current) => {
                            const selected = current.company_ids.includes(company.id);
                            return {
                              ...current,
                              company_ids: selected
                                ? current.company_ids.filter((id) => id !== company.id)
                                : [...current.company_ids, company.id],
                            };
                          });
                        }}
                      />
                      <CompanyLabel name={company.name} icon={company.icon} />
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary">{editingId ? 'Save' : 'Add person'}</button>
              <button type="button" className="btn btn--ghost" onClick={cancel}>Cancel</button>
            </div>
          </form>
        </dialog>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">No people match.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Job title</th>
              <th>Onboarded with</th>
              <th>Location</th>
              <th>Projects</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="name-cell">
                    {row.name}
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
                  </span>
                </td>
                <td>{row.department.name}</td>
                <td>{row.designation?.name || <span className="muted">—</span>}</td>
                <td className="companies-cell">{row.companies.length ? row.companies.map((company) => (
                  <CompanyLabel key={company.id} name={company.name} icon={company.icon} iconOnly />
                )) : <span className="muted">—</span>}</td>
                <td>{row.location || <span className="muted">—</span>}</td>
                <td>
                  {row.assignments.length === 0 ? <span className="muted">—</span> : row.assignments.map((item) => (
                    <button key={item.project_id} type="button" className="link" onClick={() => onOpenProject(item.project_id)}>
                      {item.project_name}
                    </button>
                  ))}
                </td>
                {canEdit ? (
                  <td className="row-actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => beginEdit(row)}>Edit</button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(row)}>Delete</button>
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
