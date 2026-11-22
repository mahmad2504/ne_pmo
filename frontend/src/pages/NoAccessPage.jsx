import { logout } from '../keycloak.js';

export default function NoAccessPage({ session }) {
  const label = session.name || session.username;
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="sidebar__brand">
          <span className="sidebar__logo">NE</span>
          <div>
            <strong>PM Tool</strong>
            <span className="sidebar__tag">Workspace</span>
          </div>
        </div>
        <h1>No access</h1>
        <p className="subtitle">
          You do not have permission to view this workspace. Request the user or admin role from an administrator.
        </p>
        {label ? <p className="subtitle">Signed in as {label}.</p> : null}
        <div className="login-actions">
          <button type="button" className="btn btn--secondary" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}
