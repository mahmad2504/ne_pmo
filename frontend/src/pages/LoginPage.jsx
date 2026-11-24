import config from '../../keycloak.config.json';
import { login } from '../keycloak.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';

export default function LoginPage({ initError }) {
  return (
    <main className="login-screen">
      <ThemeToggle className="login-theme" />
      <Card className="login-card">
        <CardHeader>
          <div className="sidebar__brand">
            <span className="sidebar__logo" aria-hidden="true">NE</span>
            <div>
              <strong>PM Tool</strong>
              <span className="sidebar__tag">Workspace</span>
            </div>
          </div>
          <h1>Sign in</h1>
          <p className="subtitle">
            Your password is entered on the Keycloak page. After you sign in, this app stays loaded while you move between projects and people.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {initError ? (
            <p className="banner" role="alert">
              Keycloak is not reachable at {config.keycloakUrl}. Start it, then reload.
            </p>
          ) : (
            <Button type="button" onClick={() => login()}>
              Log in
            </Button>
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
                      <Badge key={role} variant="secondary" className={`role role-${role}`}>{role}</Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
