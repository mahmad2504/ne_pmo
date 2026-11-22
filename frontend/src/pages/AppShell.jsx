import { logout } from '../keycloak.js';

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
          <button type="button" className={view === 'projects' ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => onNavigate('projects')}>
            Projects
          </button>
          <button type="button" className={view === 'resources' ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => onNavigate('resources')}>
            Resources
          </button>
          <button type="button" className={view === 'job-titles' ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => onNavigate('job-titles')}>
            Job titles
          </button>
          <button type="button" className={view === 'companies' ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => onNavigate('companies')}>
            Companies
          </button>
          <button type="button" className={view === 'departments' ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => onNavigate('departments')}>
            Departments
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
