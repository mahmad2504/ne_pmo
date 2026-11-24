import { useEffect, useMemo, useRef, useState } from 'react';

function personMeta(person) {
  return [person.department?.name, person.designation?.name].filter(Boolean).join(' · ');
}

function personHaystack(person) {
  return [person.name, person.email, person.department?.name, person.designation?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function AssignResourceForm({ projectName, people, roles, assignedIds, busy, error, onCancel, onSubmit }) {
  const [resourceId, setResourceId] = useState('');
  const [utilization, setUtilization] = useState('100');
  const [projectRole, setProjectRole] = useState(roles.some((item) => item.code === 'member') ? 'member' : (roles[0]?.code ?? 'member'));
  const [localError, setLocalError] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const pickerRef = useRef(null);
  const toggleRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef(new Map());

  const available = useMemo(
    () => (people ?? []).filter((person) => !assignedIds.has(person.id) && !person.resigned),
    [people, assignedIds],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return available;
    return available.filter((person) => personHaystack(person).includes(needle));
  }, [available, query]);

  const selected = (people ?? []).find((person) => String(person.id) === String(resourceId)) ?? null;
  const highlighted = filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);
  const activePerson = highlighted >= 0 ? filtered[highlighted] : null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open && available.length === 0) setOpen(false);
  }, [open, available.length]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    function onPointer(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activePerson) return;
    optionRefs.current.get(activePerson.id)?.scrollIntoView({ block: 'nearest' });
  }, [open, activePerson]);

  function handleBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    onCancel();
  }

  function choosePerson(person) {
    setResourceId(String(person.id));
    setQuery('');
    setOpen(false);
    toggleRef.current?.focus();
  }

  function moveActive(delta) {
    if (filtered.length === 0) return;
    setActiveIndex((current) => {
      const bounded = Math.min(current, filtered.length - 1);
      const next = bounded + delta;
      if (next < 0) return filtered.length - 1;
      if (next >= filtered.length) return 0;
      return next;
    });
  }

  function onSearchKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activePerson) choosePerson(activePerson);
    }
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
              <div className="person-picker__list">
                <input
                  ref={searchRef}
                  className="person-picker__search"
                  type="text"
                  value={query}
                  placeholder="Search name, email, department, or title"
                  aria-label="Search people"
                  aria-controls="person-picker-options"
                  aria-activedescendant={activePerson ? `person-option-${activePerson.id}` : undefined}
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
                <ul id="person-picker-options" className="person-picker__options" role="listbox" aria-labelledby="person-picker-label">
                  {filtered.length === 0 ? (
                    <li className="person-picker__empty">No people match</li>
                  ) : filtered.map((person, index) => {
                    const meta = personMeta(person);
                    const selectedRow = String(person.id) === String(resourceId);
                    const active = index === highlighted;
                    return (
                      <li key={person.id} role="presentation">
                        <button
                          id={`person-option-${person.id}`}
                          ref={(node) => {
                            if (node) optionRefs.current.set(person.id, node);
                            else optionRefs.current.delete(person.id);
                          }}
                          type="button"
                          role="option"
                          aria-selected={selectedRow}
                          className={active ? 'person-picker__option person-picker__option--active' : 'person-picker__option'}
                          onMouseEnter={() => setActiveIndex(index)}
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
              </div>
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
