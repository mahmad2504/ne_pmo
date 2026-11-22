import { useEffect, useState } from 'react';
import { listProjects, unarchiveProject } from '../api.js';
import { reportToneClass } from './reportTone.js';

export default function ArchivePage({ canEdit, onOpenProject }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh(query = q) {
    setLoading(true);
    setError('');
    try {
      setRows(await listProjects(query.trim(), { archived: true }));
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh('');
  }, []);

  async function restore(project) {
    setError('');
    try {
      await unarchiveProject(project.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="main-header">
        <div>
          <h1>Archive</h1>
          <p className="subtitle">Completed projects moved off the projects list.</p>
        </div>
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      <div className="toolbar">
        <label className="search-field">
          <span className="sr-only">Search archived projects</span>
          <input
            value={q}
            placeholder="Search by name or description"
            onChange={(event) => {
              const value = event.target.value;
              setQ(value);
              refresh(value);
            }}
          />
        </label>
      </div>
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">{q.trim() ? 'No archived projects match.' : 'Archive a completed project and it will show up here.'}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Labels</th>
              <th>People</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className={`link ${reportToneClass(row)}`} onClick={() => onOpenProject(row.id)}>
                    {row.name}
                  </button>
                  {row.description ? <div className="desc-clamp muted">{row.description}</div> : null}
                </td>
                <td>
                  {row.tags.length === 0 ? <span className="muted">—</span> : (
                    <ul className="label-list">
                      {row.tags.map((tag) => (
                        <li key={tag.id} className="label-chip label-chip--static" title={tag.title}>{tag.name}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>{row.resource_count}</td>
                {canEdit ? (
                  <td className="row-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => restore(row)}>Restore</button>
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
