import { logout } from '../keycloak.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';

export default function NoAccessPage({ session }) {
  const label = session.name || session.username;
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
          <h1>No access</h1>
          <p className="subtitle">
            You do not have permission to view this workspace. Request the user or admin role from an administrator.
          </p>
          {label ? <p className="subtitle">Signed in as {label}.</p> : null}
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => logout()}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
