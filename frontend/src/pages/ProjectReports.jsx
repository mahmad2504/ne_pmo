import { useEffect, useId, useState } from 'react';
import { reportHasText, sanitizeReportHtml } from '../reportHtml.js';
import RichTextEditor from './RichTextEditor.jsx';

const FLAGS = [
  { value: '', label: 'None' },
  { value: 'risk', label: 'Risk' },
  { value: 'issue', label: 'Issue' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'decision', label: 'Decision' },
];

const FLAG_LABELS = {
  risk: 'Risk',
  issue: 'Issue',
  blocker: 'Blocker',
  decision: 'Decision',
};

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function reportDateInput(value) {
  const day = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : localToday();
}

function formatReportDate(value) {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLastReportOn(value) {
  const day = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${REPORT_MONTHS[month - 1]} ${year}`;
}

function stopEnter(event) {
  if (event.key === 'Enter') event.preventDefault();
}

function reportDraftDirty(draft, body, baseline) {
  if (!draft || !baseline) return false;
  if ((draft.date || '') !== (baseline.date || '')) return true;
  if ((draft.flag || '') !== (baseline.flag || '')) return true;
  return sanitizeReportHtml(body) !== sanitizeReportHtml(baseline.body);
}

function ReportComposer({ draft, busy, error, onChange, onBodyChange, onCancel, onSave }) {
  const title = draft.id == null ? 'New report' : 'Edit report';

  return (
    <div className="report-draft">
      <p className="report-draft__title">{title}</p>
      <div className="report-draft__fields">
        <label>
          Date
          <input
            type="date"
            value={draft.date}
            disabled={busy}
            onKeyDown={stopEnter}
            onChange={(event) => onChange({ ...draft, date: event.target.value })}
          />
        </label>
        <label>
          Flag
          <select
            value={draft.flag}
            disabled={busy}
            onKeyDown={stopEnter}
            onChange={(event) => onChange({ ...draft, flag: event.target.value })}
          >
            {FLAGS.map((item) => (
              <option key={item.value || 'none'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <RichTextEditor
        key={draft.key}
        initialValue={draft.body || ''}
        disabled={busy}
        onChange={onBodyChange}
      />
      {error ? (
        <p className="modal__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="report-draft__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={onSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save report'}
        </button>
      </div>
    </div>
  );
}

export default function ProjectReports({
  reports = [],
  latestReportAt = null,
  total = 0,
  page = 1,
  pageSize = 5,
  busy = false,
  error = '',
  onSave,
  onDelete,
  onPageChange,
  onDirtyChange,
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [body, setBody] = useState('');
  const [localError, setLocalError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const reportDirty = reportDraftDirty(draft, body, baseline);

  useEffect(() => {
    onDirtyChange?.(reportDirty);
  }, [onDirtyChange, reportDirty]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function closeDraft() {
    if (busy) return;
    setDraft(null);
    setBaseline(null);
    setBody('');
    setLocalError('');
  }

  function replaceDraft() {
    if (draft && reportDirty) {
      setLocalError('Save or cancel the open report first.');
      return false;
    }
    return true;
  }

  function startAdd() {
    if (draft?.id == null && draft != null) return;
    if (!replaceDraft()) return;
    const next = { date: localToday(), flag: '', body: '' };
    setOpen(true);
    setConfirmId(null);
    setLocalError('');
    setBody('');
    setBaseline(next);
    setDraft({ id: null, date: next.date, flag: '', key: `new-${Date.now()}` });
  }

  function startEdit(report) {
    if (draft?.id === report.id) return;
    if (!replaceDraft()) return;
    const next = {
      date: reportDateInput(report.created_at),
      flag: report.flag || '',
      body: report.body || '',
    };
    setOpen(true);
    setConfirmId(null);
    setLocalError('');
    setBody(next.body);
    setBaseline(next);
    setDraft({
      id: report.id,
      date: next.date,
      flag: next.flag,
      body: next.body,
      key: `edit-${report.id}`,
    });
  }

  async function saveReport() {
    if (!draft || busy) return;
    if (!draft.date) {
      setLocalError('Choose a date.');
      return;
    }
    const stored = sanitizeReportHtml(body);
    if (!reportHasText(stored)) {
      setLocalError('Report body is required.');
      return;
    }
    setLocalError('');
    try {
      await onSave({
        id: draft.id,
        body: stored,
        created_at: `${draft.date}T00:00:00Z`,
        flag: draft.flag || null,
      });
      setDraft(null);
      setBaseline(null);
      setBody('');
    } catch {
      // The parent surfaces the request error.
    }
  }

  async function removeReport(reportId) {
    if (busy) return;
    setLocalError('');
    try {
      await onDelete(reportId);
      setConfirmId(null);
      if (draft?.id === reportId) closeDraft();
    } catch {
      // The parent surfaces the request error.
    }
  }

  const editingVisible = reports.some((report) => report.id === draft?.id);
  const composer = draft ? (
    <ReportComposer
      draft={draft}
      busy={busy}
      error={localError || error}
      onChange={setDraft}
      onBodyChange={setBody}
      onCancel={closeDraft}
      onSave={saveReport}
    />
  ) : null;
  const lastReportOn = formatLastReportOn(latestReportAt);
  const count = Number.isFinite(total) ? total : reports.length;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, count);
  const showPager = count > pageSize;

  return (
    <>
    <div className="subprojects">
      <div className="subprojects__header">
        <button
          type="button"
          className="subprojects__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          disabled={busy}
        >
          <span className={`subprojects__chevron${open ? ' subprojects__chevron--open' : ''}`} aria-hidden="true" />
          <span className="subprojects__label">Reports</span>
          <span className="subprojects__count">{count}</span>
          {lastReportOn ? (
            <span className="subprojects__submitted">Last report on {lastReportOn}</span>
          ) : null}
        </button>
        {onSave ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={startAdd} disabled={busy}>
            Add report
          </button>
        ) : null}
      </div>
      <div id={panelId} hidden={!open}>
        {error && !draft ? (
          <p className="modal__error" role="alert">
            {error}
          </p>
        ) : null}
        {draft && !editingVisible ? composer : null}
        {count === 0 ? (
          <p className="subprojects__empty">No reports yet.</p>
        ) : (
          <ul className="subprojects__list subprojects__list--open">
            {reports.map((report) => {
              const flagLabel = FLAG_LABELS[report.flag];
              const editingThis = draft?.id === report.id;
              return (
                <li key={report.id} className={`subproject report-row${editingThis ? ' report-row--editing' : ''}`}>
                  <div className="subproject__identity">
                    <div className="report-row__meta">
                      <span className="report-row__date">{formatReportDate(report.created_at)}</span>
                      {flagLabel ? (
                        <span className={`report-flag report-flag--${report.flag}`}>{flagLabel}</span>
                      ) : null}
                    </div>
                    <div className="report-row__body" dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(report.body) }} />
                  </div>
                  {onSave ? (
                  <div className="subproject__aside">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy || editingThis}
                      aria-pressed={editingThis}
                      onClick={() => startEdit(report)}
                    >
                      {editingThis ? 'Editing' : 'Edit'}
                    </button>
                    {confirmId === report.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled={busy}
                          onClick={() => removeReport(report.id)}
                        >
                          Confirm
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busy}
                        onClick={() => setConfirmId(report.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  ) : null}
                  {editingThis ? composer : null}
                </li>
              );
            })}
          </ul>
        )}
        {showPager ? (
          <nav className="pager" aria-label="Report pages">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onPageChange?.(safePage - 1)}
              disabled={busy || safePage <= 1}
            >
              Previous
            </button>
            <span className="pager__status">
              {rangeStart}–{rangeEnd} of {count}
              <span className="visually-hidden">, page {safePage} of {pageCount}</span>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onPageChange?.(safePage + 1)}
              disabled={busy || safePage >= pageCount}
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </div>
    </>
  );
}
