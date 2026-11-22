import { useEffect, useState } from 'react';
import { initKeycloak, sessionFromToken } from './keycloak.js';
import AppShell from './pages/AppShell.jsx';
import CompaniesPage from './pages/CompaniesPage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import JobTitlesPage from './pages/JobTitlesPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NoAccessPage from './pages/NoAccessPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';

function parseRoute(path = window.location.pathname) {
  if (path === '/resources') return { view: 'resources', projectId: null };
  if (path === '/departments') return { view: 'departments', projectId: null };
  if (path === '/job-titles') return { view: 'job-titles', projectId: null };
  if (path === '/companies') return { view: 'companies', projectId: null };
  const match = /^\/projects\/(\d+)$/.exec(path);
  if (match) return { view: 'projects', projectId: Number(match[1]) };
  return { view: 'projects', projectId: null };
}

function pathFor(route) {
  if (route.view === 'resources') return '/resources';
  if (route.view === 'departments') return '/departments';
  if (route.view === 'job-titles') return '/job-titles';
  if (route.view === 'companies') return '/companies';
  if (route.projectId) return `/projects/${route.projectId}`;
  return '/';
}

function canView(session) {
  return session.roles.includes('user') || session.roles.includes('admin');
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState(() => parseRoute());

  useEffect(() => {
    let active = true;
    initKeycloak()
      .then(() => {
        if (!active) return;
        const next = sessionFromToken();
        setSession(next);
        const path = next ? pathFor(parseRoute()) : '/';
        const current = window.location.pathname;
        if (current !== path) window.history.replaceState({}, '', path);
        setRoute(parseRoute());
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setInitError(error?.message || 'Could not reach Keycloak.');
        if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onPop() {
      setRoute(parseRoute());
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function go(path) {
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute(parseRoute());
  }

  function navigate(view) {
    if (view === 'resources') go('/resources');
    else if (view === 'departments') go('/departments');
    else if (view === 'job-titles') go('/job-titles');
    else if (view === 'companies') go('/companies');
    else go('/');
  }

  if (!ready) {
    return (
      <main className="login-screen">
        <p className="muted">Checking your session…</p>
      </main>
    );
  }

  if (!session) return <LoginPage initError={initError} />;
  if (!canView(session)) return <NoAccessPage session={session} />;

  const canEdit = session.roles.includes('admin');
  return (
    <AppShell session={session} view={route.projectId ? 'projects' : route.view} onNavigate={navigate}>
      {route.view === 'resources' ? (
        <ResourcesPage canEdit={canEdit} onOpenProject={(id) => go(`/projects/${id}`)} />
      ) : route.view === 'departments' ? (
        <DepartmentsPage canEdit={canEdit} />
      ) : route.view === 'job-titles' ? (
        <JobTitlesPage canEdit={canEdit} />
      ) : route.view === 'companies' ? (
        <CompaniesPage canEdit={canEdit} />
      ) : route.projectId ? (
        <ProjectPage
          key={route.projectId}
          projectId={route.projectId}
          canEdit={canEdit}
          onClose={() => go('/')}
        />
      ) : (
        <ProjectsPage canEdit={canEdit} onOpenProject={(id) => go(`/projects/${id}`)} />
      )}
    </AppShell>
  );
}
