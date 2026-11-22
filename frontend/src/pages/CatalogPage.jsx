import { useEffect, useRef, useState } from 'react';
import CompanyLabel, { CompanyMark } from '../components/CompanyLabel.jsx';

const emptyForm = { name: '', description: '', icon: '' };

function readIcon(file) {
  return new Promise((resolve, reject) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      reject(new Error('Icon must be a PNG, JPEG, WebP, or GIF'));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const size = 64;
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    image.src = url;
  });
}

export default function CatalogPage({ title, subtitle, noun, plural, emptyLabel, withIcon, inDialog, searchable, canEdit, load, create, update, remove }) {
  const nouns = plural || `${noun}s`;
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef(null);
  const closingRef = useRef(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setRows(await load());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!inDialog) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showForm && !dialog.open) {
      dialog.showModal();
    } else if (!showForm && dialog.open) {
      closingRef.current = true;
      dialog.close();
      closingRef.current = false;
    }
  }, [inDialog, showForm]);

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setFormError('');
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setForm({ name: row.name, description: row.description || '', icon: row.icon || '' });
    setShowForm(true);
    setError('');
    setFormError('');
  }

  async function onIcon(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setFormError('');
    try {
      const icon = await readIcon(file);
      setForm((current) => ({ ...current, icon }));
    } catch (err) {
      if (inDialog) setFormError(err.message);
      else setError(err.message);
    }
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
    setError('');
    setFormError('');
    const body = { name: form.name, description: form.description };
    if (withIcon) body.icon = form.icon || null;
    try {
      if (editingId) await update(editingId, body);
      else await create(body);
      cancel();
      await refresh();
    } catch (err) {
      if (inDialog) setFormError(err.message);
      else setError(err.message);
    }
  }

  async function onDelete(row) {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    setError('');
    try {
      await remove(row.id);
      if (editingId === row.id) cancel();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const query = q.trim().toLowerCase();
  const visible = query
    ? rows.filter((row) =>
        row.name.toLowerCase().includes(query)
        || (row.description || '').toLowerCase().includes(query))
    : rows;

  const formFields = (
    <>
      {inDialog ? (
        <h2 id="catalog-dialog-title" className="dialog-heading">{editingId ? `Edit ${noun}` : `Add ${noun}`}</h2>
      ) : null}
      {inDialog && formError ? <p className="banner" role="alert">{formError}</p> : null}
      <label>
        Name
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
      </label>
      <label className={inDialog ? 'field-wide' : undefined}>
        Description
        <textarea
          rows={6}
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        />
      </label>
      {withIcon ? (
        <div className="icon-field">
          <label>
            Icon
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onIcon} />
          </label>
          <span className="icon-preview">
            <CompanyMark name={form.name} icon={form.icon} decorative />
            {form.icon ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm((current) => ({ ...current, icon: '' }))}>
                Remove icon
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary">{editingId ? 'Save' : `Add ${noun}`}</button>
        {inDialog || editingId ? (
          <button type="button" className="btn btn--ghost" onClick={cancel}>Cancel</button>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      <header className="main-header">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        {canEdit && inDialog ? (
          <button type="button" className="btn btn--primary" onClick={beginCreate}>Add {noun}</button>
        ) : null}
      </header>
      {error ? <p className="banner" role="alert">{error}</p> : null}
      {searchable ? (
        <div className="toolbar">
          <label className="search-field">
            <span className="sr-only">Filter {nouns}</span>
            <input
              value={q}
              placeholder="Filter by name or description"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      {canEdit && inDialog ? (
        <dialog
          ref={dialogRef}
          className="dialog"
          aria-labelledby="catalog-dialog-title"
          onCancel={onDialogCancel}
          onClose={onDialogClose}
        >
          <form className="form-grid" onSubmit={onSubmit}>
            {formFields}
          </form>
        </dialog>
      ) : null}
      {canEdit && !inDialog ? (
        <form className="panel form-grid" onSubmit={onSubmit}>
          {formFields}
        </form>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? (
        <p className="empty">{emptyLabel || `No ${nouns} yet.`}</p>
      ) : visible.length === 0 ? (
        <p className="empty">No {nouns} match.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>People</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td><CompanyLabel name={row.name} icon={withIcon ? row.icon : null} /></td>
                <td>{row.description || <span className="muted">—</span>}</td>
                <td>{row.resource_count}</td>
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
