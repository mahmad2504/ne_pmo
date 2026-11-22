import { useEffect, useState } from 'react';
import { updateAssignment } from '../api.js';

export function userCountLabel(count) {
  const total = Number.isFinite(count) ? count : 0;
  return `${total} ${total === 1 ? 'person' : 'people'}`;
}

export function UsersButton({ count, onClick, disabled = false }) {
  const total = Number.isFinite(count) ? count : 0;
  const label = userCountLabel(total);
  return (
    <button type="button" className="project-users" title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.5 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-2.67 0-8 1.34-8 4v1.5h10.2A6.4 6.4 0 0 1 11 16c0-1.1.3-2.13.82-3.02C10.9 13 10 13 9 13zm7.5 1c-.7 0-1.36.08-1.97.22A4.48 4.48 0 0 1 16.5 18v.5H22V18c0-2.21-3.36-4-5.5-4z"
        />
      </svg>
      <span>{total}</span>
    </button>
  );
}

export default function ProjectUsersDialog({ project, canEdit, onClose, onUpdated }) {
  const [rows, setRows] = useState(project.assignments ?? []);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(project.assignments ?? []);
  }, [project]);

  function handleBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    onClose();
  }

  async function saveUtilization(row) {
    const text = drafts[row.resource_id] ?? String(row.utilization_percent);
    if (!/^\d+$/.test(text.trim()) || Number(text) > 100) {
      setError('Utilization must be a whole number from 0 to 100.');
      return;
    }
    const percent = Number(text);
    if (percent === row.utilization_percent) return;
    setSavingId(row.resource_id);
    setError('');
    try {
      const next = await updateAssignment(project.id, row.resource_id, { utilization_percent: percent });
      setRows(next.assignments);
      onUpdated?.(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdrop}>
      <div className="modal modal--users" role="dialog" aria-modal="true" aria-labelledby="project-users-title">
        <div className="modal__header">
          <div>
            <h2 id="project-users-title">{project.name}</h2>
            <p className="subtitle">People and utilization</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {error ? <p className="modal__error" role="alert">{error}</p> : null}
        {rows.length === 0 ? <p className="modal__hint">No one is assigned yet.</p> : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.resource_id}>
                  <td>{row.name}</td>
                  <td>{row.project_role}</td>
                  <td>
                    {canEdit ? (
                      <input
                        className="util-input"
                        inputMode="numeric"
                        value={drafts[row.resource_id] ?? String(row.utilization_percent)}
                        aria-label={`Utilization for ${row.name}`}
                        disabled={savingId === row.resource_id}
                        onChange={(event) => setDrafts((current) => ({ ...current, [row.resource_id]: event.target.value }))}
                        onBlur={() => saveUtilization(row)}
                      />
                    ) : `${row.utilization_percent}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
