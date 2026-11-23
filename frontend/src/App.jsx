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
import EditViewPage from './pages/EditViewPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';

function groupQuery(group) {
  if (!group) return '';
  return `?group=${encodeURIComponent(group)}`;
}

function resourceQuery(resourceId) {
  if (!resourceId) return '';
  return `?resource=${resourceId}`;
}

function parseResource(params) {
  const raw = params.get('resource');
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function parseRoute(path = window.location.pathname, search = window.location.search) {
  const params = new URLSearchParams(search);
  const raw = params.get('group');
  const group = raw && raw.trim() ? raw : null;
  const from = params.get('from') === 'archive' ? 'archive' : null;
  const resourceId = from ? null : parseResource(params);
  const blank = { projectId: null, group: null, from: null, resourceId: null, viewId: null };
  if (path === '/resources') return { view: 'resources', ...blank };
  if (path === '/resigned') return { view: 'resigned', ...blank };
  if (path === '/departments') return { view: 'departments', ...blank };
  if (path === '/job-titles') return { view: 'job-titles', ...blank };
  if (path === '/companies') return { view: 'companies', ...blank };
  if (path === '/labels') return { view: 'labels', ...blank };
  if (path === '/archive') return { view: 'archive', ...blank };
  const viewMatch = /^\/views\/(\d+)$/.exec(path);
  if (viewMatch) return { view: 'view-edit', ...blank, viewId: Number(viewMatch[1]) };
  const match = /^\/projects\/(\d+)$/.exec(path);
  if (match) {
    return {
      view: from ? 'archive' : 'projects',
      projectId: Number(match[1]),
      group: resourceId ? null : group,
      from,
      resourceId,
    };
  }
  return { view: 'projects', projectId: null, group: resourceId ? null : group, from: null, resourceId };
}

function pathFor(route) {
  if (route.view === 'resources') return '/resources';
  if (route.view === 'resigned') return '/resigned';
  if (route.view === 'departments') return '/departments';
  if (route.view === 'job-titles') return '/job-titles';
  if (route.view === 'companies') return '/companies';
  if (route.view === 'labels') return '/labels';
  if (route.view === 'view-edit') return `/views/${route.viewId}`;
  if (route.projectId) {
    const query = route.from === 'archive' ? '?from=archive' : (resourceQuery(route.resourceId) || groupQuery(route.group));
    return `/projects/${route.projectId}${query}`;
  }
  if (route.view === 'archive') return '/archive';
  if (route.resourceId) return `/${resourceQuery(route.resourceId)}`;
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
    if (!session || route.view !== 'view-edit' || session.roles.includes('admin')) return;
    const path = route.viewId ? `/?group=${encodeURIComponent(route.viewId)}` : '/';
    if (currentLocation() === path) return;
    window.history.replaceState(null, '', path);
    setRoute(parseRoute());
  }, [session, route.view, route.viewId]);

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
    else if (view === 'resigned') go('/resigned');
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
      view={route.from === 'archive' ? 'archive' : (route.projectId || route.view === 'view-edit' ? 'projects' : route.view)}
      onNavigate={navigate}
    >
      {route.view === 'resources' ? (
        <ResourcesPage key="resources" canEdit={canEdit} onOpenProjects={(id) => go(`/?resource=${id}`)} />
      ) : route.view === 'resigned' ? (
        <ResourcesPage key="resigned" resignedOnly canEdit={canEdit} onOpenProjects={(id) => go(`/?resource=${id}`)} />
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
          backLabel={route.from === 'archive' ? 'Archive' : 'Projects'}
          onClose={() => go(route.from === 'archive' ? '/archive' : (route.resourceId ? `/?resource=${route.resourceId}` : `/${groupQuery(route.group)}`))}
        />
      ) : route.view === 'archive' ? (
        <ArchivePage canEdit={canEdit} onOpenProject={(id) => go(`/projects/${id}?from=archive`)} />
      ) : route.view === 'view-edit' ? (
        canEdit ? (
          <EditViewPage
            key={route.viewId}
            viewId={route.viewId}
            onGroupsChanged={reloadGroups}
            onClose={() => go(`/?group=${route.viewId}`)}
            onDeleted={() => go('/')}
          />
        ) : (
          <p className="muted">Loading…</p>
        )
      ) : (
        <ProjectsPage
          canEdit={canEdit}
          group={route.group}
          groups={groups}
          onGroupsChanged={reloadGroups}
          onSelectGroup={(value) => go(value ? `/?group=${encodeURIComponent(value)}` : '/')}
          onEditView={(id) => go(`/views/${id}`)}
          resourceId={route.resourceId}
          onClearResource={() => go('/')}
          onOpenProject={(id) => go(`/projects/${id}${route.resourceId ? resourceQuery(route.resourceId) : groupQuery(route.group)}`)}
        />
      )}
    </AppShell>
  );
}
