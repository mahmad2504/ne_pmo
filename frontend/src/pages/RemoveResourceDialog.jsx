import { useState } from 'react';

function utcDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export default function RemoveResourceDialog({ assignment, projectName, busy, error, onCancel, onConfirm }) {
  const originalDay = utcDay(assignment.started_at);
  const [mode, setMode] = useState('record');
  const [fromDate, setFromDate] = useState(originalDay);
  const [toDate, setToDate] = useState(todayUtc);
  const [highlights, setHighlights] = useState('');
  const [localError, setLocalError] = useState('');
  const shownError = localError || error;

  function choose(next) {
    setMode(next);
    setLocalError('');
  }

  function handleBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    onCancel();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (mode === 'none') {
      setLocalError('');
      onConfirm({ resourceId: assignment.resource_id, record: false });
      return;
    }
    if (!fromDate || !toDate) {
      setLocalError('Choose a start date and an end date.');
      return;
    }
    if (toDate < fromDate) {
      setLocalError('End date cannot be before the contribution started');
      return;
    }
    setLocalError('');
    const startedAt = fromDate === originalDay && assignment.started_at
      ? assignment.started_at
      : `${fromDate}T00:00:00Z`;
    let endedAt = `${toDate}T00:00:00Z`;
    if (endedAt < startedAt) endedAt = startedAt;
    onConfirm({
      resourceId: assignment.resource_id,
      record: true,
      startedAt,
      endedAt,
      highlights: highlights.trim(),
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdrop}>
      <form className="modal" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="remove-resource-title">
        <div className="modal__header">
          <h2 id="remove-resource-title">Remove {assignment.name}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </div>
        <p className="modal__hint">Remove {assignment.name} from {projectName}.</p>
        <div className="modal__form">
          <div className="remove-choices">
            <label className="check-field">
              <input type="radio" name="remove-mode" checked={mode === 'none'} disabled={busy} onChange={() => choose('none')} />
              Remove with no record of contribution
            </label>
            <label className="check-field">
              <input type="radio" name="remove-mode" checked={mode === 'record'} disabled={busy} onChange={() => choose('record')} />
              Record as a project contributor
            </label>
          </div>
          {mode === 'record' ? (
            <>
              <div className="remove-dates">
                <label>
                  From
                  <input type="date" value={fromDate} disabled={busy} required onChange={(event) => setFromDate(event.target.value)} />
                </label>
                <label>
                  To
                  <input type="date" value={toDate} disabled={busy} required onChange={(event) => setToDate(event.target.value)} />
                </label>
              </div>
              <label>
                Contribution highlights
                <textarea value={highlights} rows={3} maxLength={4000} disabled={busy} placeholder="Optional" onChange={(event) => setHighlights(event.target.value)} />
              </label>
            </>
          ) : null}
          {shownError ? <p className="modal__error" role="alert">{shownError}</p> : null}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Removing…' : 'Remove'}</button>
        </div>
      </form>
    </div>
  );
}
