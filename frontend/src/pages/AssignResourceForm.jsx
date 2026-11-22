import { useEffect, useMemo, useRef, useState } from 'react';

function personMeta(person) {
  return [person.department?.name, person.designation?.name].filter(Boolean).join(' · ');
}

export default function AssignResourceForm({ projectName, people, roles, assignedIds, busy, error, onCancel, onSubmit }) {
  const [resourceId, setResourceId] = useState('');
  const [utilization, setUtilization] = useState('100');
  const [projectRole, setProjectRole] = useState(roles.some((item) => item.code === 'member') ? 'member' : (roles[0]?.code ?? 'member'));
  const [localError, setLocalError] = useState('');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const toggleRef = useRef(null);

  const available = useMemo(
    () => (people ?? []).filter((person) => !assignedIds.has(person.id)),
    [people, assignedIds],
  );

  const selected = (people ?? []).find((person) => String(person.id) === String(resourceId)) ?? null;

  useEffect(() => {
    if (open && available.length === 0) setOpen(false);
  }, [open, available.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    onCancel();
  }

  function choosePerson(person) {
    setResourceId(String(person.id));
    setOpen(false);
    toggleRef.current?.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!/^\d+$/.test(utilization.trim()) || Number(utilization) > 100) {
      setLocalError('Utilization must be a whole number from 0 to 100.');
      return;
    }
    if (!resourceId) {
      setLocalError('Choose a person.');
      return;
    }
    setLocalError('');
    onSubmit({
      resource_id: Number(resourceId),
      utilization_percent: Number(utilization),
      project_role: projectRole,
    });
  }

  const shownError = localError || error;
  const closedLabel = selected?.name ?? (available.length === 0 ? 'No one available' : 'Choose a person');

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdrop}>
      <form className="modal modal--person" onSubmit={handleSubmit}>
        <div className="modal__header">
          <h2>Add person</h2>
          <button type="button" className="icon-btn" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </div>
        <p className="modal__hint">Assign someone from the directory to {projectName}.</p>
        <div className="modal__form">
          <div className="person-picker" ref={pickerRef}>
            <span id="person-picker-label">Person</span>
            <button
              ref={toggleRef}
              type="button"
              className="person-picker__toggle"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-labelledby="person-picker-label"
              disabled={available.length === 0}
              onClick={() => setOpen((current) => !current)}
            >
              <span className={selected ? 'person-picker__name' : 'person-picker__placeholder'}>{closedLabel}</span>
              <span className="person-picker__caret" aria-hidden="true" />
            </button>
            {open ? (
              <ul className="person-picker__list" role="listbox" aria-labelledby="person-picker-label">
                {available.map((person) => {
                  const meta = personMeta(person);
                  const selectedRow = String(person.id) === String(resourceId);
                  return (
                    <li key={person.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedRow}
                        className="person-picker__option"
                        onClick={() => choosePerson(person)}
                      >
                        <span className="person-picker__title">
                          <span className="person-picker__name">{person.name}</span>
                          {person.email ? <span className="person-picker__email">{person.email}</span> : null}
                        </span>
                        {meta ? <span className="person-picker__meta">{meta}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <label>
            Project role
            <select value={projectRole} onChange={(event) => setProjectRole(event.target.value)}>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>{role.label}</option>
              ))}
            </select>
          </label>
          <label>
            Utilization %
            <input value={utilization} inputMode="numeric" onChange={(event) => setUtilization(event.target.value)} />
          </label>
          {shownError ? <p className="modal__error" role="alert">{shownError}</p> : null}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !resourceId}>{busy ? 'Adding…' : 'Add to project'}</button>
        </div>
      </form>
    </div>
  );
}
