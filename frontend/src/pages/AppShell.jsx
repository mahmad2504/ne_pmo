import {
  Archive,
  Briefcase,
  Building2,
  FolderKanban,
  LogOut,
  Network,
  Tags,
  UserMinus,
  Users,
} from 'lucide-react';
import { logout } from '../keycloak.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';

const NAV = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'resources', label: 'Resources', icon: Users },
  { id: 'resigned', label: 'Resigned', icon: UserMinus },
  { id: 'job-titles', label: 'Job titles', icon: Briefcase },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'departments', label: 'Departments', icon: Network },
  { id: 'labels', label: 'Labels', icon: Tags },
  { id: 'archive', label: 'Archive', icon: Archive },
];

function initials(label) {
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppShell({ session, view, onNavigate, children }) {
  const label = session.name || session.username;
  const role = session.roles.includes('admin') ? 'admin' : 'user';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">NE</span>
          <div>
            <strong>PM Tool</strong>
            <span className="sidebar__tag">Workspace</span>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Workspace">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className={active ? 'nav-item nav-item--active' : 'nav-item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon />
                {item.label}
              </Button>
            );
          })}
        </nav>
        <Separator />
        <div className="sidebar__foot">
          <div className="sidebar__who">
            <span className="sidebar__avatar" aria-hidden="true">{initials(label)}</span>
            <span className="sidebar__identity">
              <span className="sidebar__name">{label}</span>
              <Badge variant="secondary" className={`role role-${role}`}>{role}</Badge>
            </span>
          </div>
          <ThemeToggle className="theme-toggle" />
          <Button type="button" variant="outline" className="sidebar__logout" onClick={() => logout()}>
            <LogOut />
            Log out
          </Button>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
