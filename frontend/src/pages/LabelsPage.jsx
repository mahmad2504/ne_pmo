import { useEffect, useState } from 'react';
import { createTag, deleteTag, listTags, updateTag } from '../api.js';

function cleanSymbol(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

function LabelDialog({ label, busy, error, onCancel, onSubmit }) {
  const editing = Boolean(label);
  const [symbol, setSymbol] = useState(label?.name ?? '');
  const [title, setTitle] = useState(label?.title ?? '');
  const [description, setDescription] = useState(label?.description ?? '');
  const [localError, setLocalError] = useState('');
  const message = localError || error;

  function handleBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    onCancel();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = cleanSymbol(symbol);
    const nextTitle = cleanSymbol(title);
    if (!name) {
      setLocalError('A symbol is required.');
      return;
    }
    if (name.length > 64) {
      setLocalError('A label can be at most 64 characters.');
      return;
    }
    if (!nextTitle) {
      setLocalError('A title is required.');
      return;
    }
    setLocalError('');
    onSubmit({ name, title: nextTitle, description: description.trim() || null });
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdrop}>
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal__header">
          <h2>{editing ? 'Edit label' : 'Add label'}</h2>
          <button type="button" className="icon-btn" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        </div>
        <div className="modal__form">
          <label>
            Symbol
            <input value={symbol} onChange={(event) => setSymbol(event.target.value)} required maxLength={64} autoFocus />
          </label>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={255} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
          </label>
          {message ? <p className="modal__error" role="alert">{message}</p> : null}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function LabelsPage({ canEdit }) {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    listTags()
      .then((rows) => {
        if (active) setLabels(rows ?? []);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(body) {
    setSaving(true);
    setSaveError('');
    try {
      const saved = editor?.id ? await updateTag(editor.id, body) : await createTag(body);
      setLabels((current) => {
        const next = editor?.id
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved];
        next.sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
        return next;
      });
      setEditor(null);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(label) {
    const used = label.project_count > 0 ? ` It will be removed from ${label.project_count} projects.` : '';
    if (!window.confirm(`Delete ${label.name}?${used}`)) return;
    setLoadError('');
    try {
      await deleteTag(label.id);
      setLabels((current) => current.filter((item) => item.id !== label.id));
    } catch (error) {
      setLoadError(error.message);
    }
  }

  return (
    <>
      <header className="main-header">
        <div>
          <h1>Labels</h1>
          <p className="subtitle">Short symbols used on projects, each with a title and description.</p>
        </div>
        {canEdit ? (
          <button type="button" className="btn btn--primary" onClick={() => { setSaveError(''); setEditor({}); }}>
            Add label
          </button>
        ) : null}
      </header>
      {loading ? <p className="muted">Loading labels…</p> : null}
      {loadError ? <p className="banner" role="alert">{loadError}</p> : null}
      {!loading && !loadError && labels.length === 0 ? <p className="empty">No labels yet.</p> : null}
      {labels.length > 0 ? (
        <table className="data">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Title</th>
              <th>Description</th>
              <th>Projects</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label.id}>
                <td>{label.name}</td>
                <td>{label.title}</td>
                <td>{label.description || <span className="muted">—</span>}</td>
                <td>{label.project_count}</td>
                {canEdit ? (
                  <td className="row-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setSaveError(''); setEditor(label); }}>Edit</button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(label)}>Delete</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {editor ? (
        <LabelDialog
          key={editor.id ?? 'new'}
          label={editor.id ? editor : null}
          busy={saving}
          error={saveError}
          onCancel={() => { if (!saving) setEditor(null); }}
          onSubmit={handleSave}
        />
      ) : null}
    </>
  );
}
