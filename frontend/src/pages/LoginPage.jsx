import config from '../../keycloak.config.json';
import { login } from '../keycloak.js';

export default function LoginPage({ initError }) {
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
        <h1>Sign in</h1>
        <p className="subtitle">
          Your password is entered on the Keycloak page. After you sign in, this app stays loaded while you move between projects and people.
        </p>
        {initError ? (
          <p className="banner" role="alert">
            Keycloak is not reachable at {config.keycloakUrl}. Start it, then reload.
          </p>
        ) : (
          <div className="login-actions">
            <button type="button" className="btn btn--primary" onClick={() => login()}>
              Log in
            </button>
          </div>
        )}
        <div className="accounts-block">
          <h2>Demo accounts</h2>
          <ul className="accounts">
            {config.users.map((user) => (
              <li key={user.username}>
                <span>
                  <strong>{user.username}</strong>
                  <span className="muted"> / {user.password}</span>
                </span>
                <span className="roles">
                  {user.roles.map((role) => (
                    <span key={role} className={`role role-${role}`}>{role}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
