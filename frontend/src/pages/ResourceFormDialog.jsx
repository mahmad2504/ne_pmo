import { useEffect, useRef, useState } from 'react';
import CompanyLabel from '../components/CompanyLabel.jsx';
import { createResource, updateResource } from '../api.js';

const emptyForm = {
  name: '',
  email: '',
  department_id: '',
  designation_id: '',
  location: '',
  companies: [],
  resigned: false,
};

function formFromPerson(person, departments) {
  if (!person) {
    return {
      ...emptyForm,
      department_id: departments[0] ? String(departments[0].id) : '',
    };
  }
  return {
    name: person.name,
    email: person.email,
    department_id: String(person.department.id),
    designation_id: person.designation ? String(person.designation.id) : '',
    location: person.location || '',
    companies: person.companies.map((company) => ({
      id: company.id,
      email: company.email || '',
    })),
    resigned: Boolean(person.resigned),
  };
}

export default function ResourceFormDialog({ person, departments, titles, companies, locations, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const activeRef = useRef(true);
  const [form, setForm] = useState(() => formFromPerson(person, departments));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() {
    activeRef.current = false;
    onClose();
  }

  function onDialogCancel(event) {
    event.preventDefault();
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
      companies: form.companies.map((company) => ({
        id: company.id,
        email: company.email.trim() ? company.email.trim() : null,
      })),
      resigned: form.resigned,
    };
    try {
      const saved = person ? await updateResource(person.id, body) : await createResource(body);
      await onSaved(saved);
      if (activeRef.current) onClose();
    } catch (err) {
      if (activeRef.current) setFormError(err.message);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="resource-dialog-title"
      onCancel={onDialogCancel}
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <h2 id="resource-dialog-title" className="dialog-heading">{person ? 'Edit person' : 'Add person'}</h2>
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
        <label>
          Resigned
          <span className="check-slot">
            <input
              type="checkbox"
              checked={form.resigned}
              onChange={(event) => setForm((current) => ({ ...current, resigned: event.target.checked }))}
            />
          </span>
        </label>
        <fieldset className="check-group">
          <legend>Onboarded</legend>
          {companies.length === 0 ? (
            <span className="muted">No companies yet.</span>
          ) : (
            <div className="check-list check-list--stack">
              {companies.map((company) => {
                const selected = form.companies.find((row) => row.id === company.id);
                return (
                  <div key={company.id} className="company-onboard">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => {
                          setForm((current) => {
                            const already = current.companies.some((row) => row.id === company.id);
                            return {
                              ...current,
                              companies: already
                                ? current.companies.filter((row) => row.id !== company.id)
                                : [...current.companies, { id: company.id, email: '' }],
                            };
                          });
                        }}
                      />
                      <CompanyLabel name={company.name} icon={company.icon} />
                    </label>
                    {selected ? (
                      <input
                        className="company-onboard__email"
                        type="email"
                        value={selected.email}
                        placeholder={`Email at ${company.name}`}
                        aria-label={`Email at ${company.name}`}
                        autoComplete="off"
                        onChange={(event) => {
                          const email = event.target.value;
                          setForm((current) => ({
                            ...current,
                            companies: current.companies.map((row) => (
                              row.id === company.id ? { ...row, email } : row
                            )),
                          }));
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary">{person ? 'Save' : 'Add person'}</button>
          <button type="button" className="btn btn--ghost" onClick={close}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
