import { logout } from '../keycloak.js';

function navClass(active) {
  return active ? 'nav-item nav-item--active' : 'nav-item';
}

export default function AppShell({ session, view, onNavigate, children }) {
  const label = session.name || session.username;
  const role = session.roles.includes('admin') ? 'admin' : 'user';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">NE</span>
          <div>
            <strong>PM Tool</strong>
            <span className="sidebar__tag">Workspace</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          <button type="button" className={navClass(view === 'projects')} onClick={() => onNavigate('projects')}>
            Projects
          </button>
          <button type="button" className={navClass(view === 'resources')} onClick={() => onNavigate('resources')}>
            Resources
          </button>
          <button type="button" className={navClass(view === 'resigned')} onClick={() => onNavigate('resigned')}>
            Resigned
          </button>
          <button type="button" className={navClass(view === 'job-titles')} onClick={() => onNavigate('job-titles')}>
            Job titles
          </button>
          <button type="button" className={navClass(view === 'companies')} onClick={() => onNavigate('companies')}>
            Companies
          </button>
          <button type="button" className={navClass(view === 'departments')} onClick={() => onNavigate('departments')}>
            Departments
          </button>
          <button type="button" className={navClass(view === 'labels')} onClick={() => onNavigate('labels')}>
            Labels
          </button>
          <button type="button" className={navClass(view === 'archive')} onClick={() => onNavigate('archive')}>
            Archive
          </button>
        </nav>
        <div className="sidebar__foot">
          <span className="sidebar__who">
            {label}
            <span className={`role role-${role}`}>{role}</span>
          </span>
          <button type="button" className="btn btn--ghost" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
