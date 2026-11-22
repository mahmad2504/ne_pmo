import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjectGroups } from './api.js';
import { initKeycloak, sessionFromToken } from './keycloak.js';
import AppShell from './pages/AppShell.jsx';
import ArchivePage from './pages/ArchivePage.jsx';
import CompaniesPage from './pages/CompaniesPage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import JobTitlesPage from './pages/JobTitlesPage.jsx';
import LabelsPage from './pages/LabelsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NoAccessPage from './pages/NoAccessPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';

function groupQuery(group) {
  if (!group) return '';
  return `?group=${encodeURIComponent(group)}`;
}

function parseRoute(path = window.location.pathname, search = window.location.search) {
  const params = new URLSearchParams(search);
  const raw = params.get('group');
  const group = raw && raw.trim() ? raw : null;
  const from = params.get('from') === 'archive' ? 'archive' : null;
  const blank = { projectId: null, group: null, from: null };
  if (path === '/resources') return { view: 'resources', ...blank };
  if (path === '/departments') return { view: 'departments', ...blank };
  if (path === '/job-titles') return { view: 'job-titles', ...blank };
  if (path === '/companies') return { view: 'companies', ...blank };
  if (path === '/labels') return { view: 'labels', ...blank };
  if (path === '/archive') return { view: 'archive', ...blank };
  const match = /^\/projects\/(\d+)$/.exec(path);
  if (match) {
    return { view: from ? 'archive' : 'projects', projectId: Number(match[1]), group, from };
  }
  return { view: 'projects', projectId: null, group, from: null };
}

function pathFor(route) {
  if (route.view === 'resources') return '/resources';
  if (route.view === 'departments') return '/departments';
  if (route.view === 'job-titles') return '/job-titles';
  if (route.view === 'companies') return '/companies';
  if (route.view === 'labels') return '/labels';
  if (route.projectId) {
    const query = route.from === 'archive' ? '?from=archive' : groupQuery(route.group);
    return `/projects/${route.projectId}${query}`;
  }
  if (route.view === 'archive') return '/archive';
  return `/${groupQuery(route.group)}`;
}

function currentLocation() {
  return window.location.pathname + window.location.search;
}

function canView(session) {
  return session.roles.includes('user') || session.roles.includes('admin');
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState(() => parseRoute());
  const [groups, setGroups] = useState([]);
  const routeRef = useRef(route);
  const leaveGuardRef = useRef(null);
  routeRef.current = route;

  const registerLeaveGuard = useCallback((guard) => {
    leaveGuardRef.current = guard;
    return () => {
      if (leaveGuardRef.current === guard) leaveGuardRef.current = null;
    };
  }, []);

  function allowLeave() {
    const guard = leaveGuardRef.current;
    if (!guard?.isDirty?.()) return Promise.resolve(true);
    return Promise.resolve(guard.confirm());
  }

  const reloadGroups = useCallback(async () => {
    const viewRows = await listProjectGroups();
    setGroups(viewRows);
  }, []);

  useEffect(() => {
    let active = true;
    initKeycloak()
      .then(() => {
        if (!active) return;
        const next = sessionFromToken();
        setSession(next);
        const path = next ? pathFor(parseRoute()) : '/';
        if (currentLocation() !== path) window.history.replaceState({}, '', path);
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
      const destination = parseRoute();
      const guard = leaveGuardRef.current;
      if (!guard?.isDirty?.()) {
        setRoute(destination);
        return;
      }
      window.history.pushState(null, '', pathFor(routeRef.current));
      Promise.resolve(guard.confirm()).then((ok) => {
        if (!ok) return;
        window.history.pushState(null, '', pathFor(destination));
        setRoute(destination);
      });
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!session || !canView(session)) return;
    let active = true;
    listProjectGroups()
      .then((viewRows) => {
        if (active) setGroups(viewRows);
      })
      .catch(() => {
        if (active) setGroups([]);
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function go(path) {
    if (currentLocation() === path) {
      setRoute(parseRoute());
      return;
    }
    if (!(await allowLeave())) return;
    window.history.pushState(null, '', path);
    setRoute(parseRoute());
  }

  function navigate(view) {
    if (view === 'resources') go('/resources');
    else if (view === 'departments') go('/departments');
    else if (view === 'job-titles') go('/job-titles');
    else if (view === 'companies') go('/companies');
    else if (view === 'labels') go('/labels');
    else if (view === 'archive') go('/archive');
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
    <AppShell
      session={session}
      view={route.from === 'archive' ? 'archive' : (route.projectId ? 'projects' : route.view)}
      groups={groups}
      activeGroup={route.view === 'projects' && route.from !== 'archive' ? route.group : undefined}
      onNavigate={navigate}
      onSelectGroup={(value) => go(value ? `/?group=${encodeURIComponent(value)}` : '/')}
    >
      {route.view === 'resources' ? (
        <ResourcesPage canEdit={canEdit} onOpenProject={(id) => go(`/projects/${id}`)} />
      ) : route.view === 'departments' ? (
        <DepartmentsPage canEdit={canEdit} />
      ) : route.view === 'job-titles' ? (
        <JobTitlesPage canEdit={canEdit} />
      ) : route.view === 'companies' ? (
        <CompaniesPage canEdit={canEdit} />
      ) : route.view === 'labels' ? (
        <LabelsPage canEdit={canEdit} />
      ) : route.projectId ? (
        <ProjectPage
          key={route.projectId}
          projectId={route.projectId}
          canEdit={canEdit}
          registerLeaveGuard={registerLeaveGuard}
          onClose={() => go(route.from === 'archive' ? '/archive' : `/${groupQuery(route.group)}`)}
        />
      ) : route.view === 'archive' ? (
        <ArchivePage canEdit={canEdit} onOpenProject={(id) => go(`/projects/${id}?from=archive`)} />
      ) : (
        <ProjectsPage
          canEdit={canEdit}
          group={route.group}
          groups={groups}
          onGroupsChanged={reloadGroups}
          onSelectGroup={(value) => go(value ? `/?group=${encodeURIComponent(value)}` : '/')}
          onOpenProject={(id) => go(`/projects/${id}${groupQuery(route.group)}`)}
        />
      )}
    </AppShell>
  );
}
