import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { Menu, X, LogOut, Bell, ExternalLink, type LucideIcon } from 'lucide-react';
import { Logo } from '../Logo.js';
import { Badge } from '../ui.js';
import { cn } from '../../lib/cn.js';
import { useAuth } from '../../lib/auth.js';
import { isDemo } from '../../lib/config.js';
import { useStore } from '../../lib/store.js';
import { initials } from '../../lib/format.js';
import { DemoTour } from './DemoTour.js';
import { TourProvider, TourButton } from '../tour/Tour.js';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function DashShell({ nav, title }: { nav: NavItem[]; title: string }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useStore((d) => d.notifications.filter((n) => n.user_id === user?.id && !n.is_read).length);

  function doLogout() {
    logout();
    navigate('/');
  }

  return (
    <TourProvider>
    <div className="min-h-screen bg-cream lg:flex">
      {/* Sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-64 transform border-r border-black/5 bg-white transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between border-b border-black/5 px-5">
          <Logo to={user ? '/' : '/'} />
          <button className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-warm">{title}</div>
        <nav className="space-y-0.5 px-3" data-tour="dash-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-card px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary-50 text-primary-700' : 'text-ink/70 hover:bg-black/[0.03] hover:text-ink')}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-black/5 p-3">
          <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm font-medium text-ink/70 hover:bg-black/[0.03]">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-cream/85 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex flex-1 items-center justify-end gap-3">
            {isDemo() && <Badge tone="gold"><span className="hidden sm:inline">Demo sandbox — </span>nothing is saved</Badge>}
            <TourButton />
            <NotificationButton count={unread} />
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">{initials(user?.full_name)}</span>
              <div className="hidden text-sm sm:block">
                <div className="font-medium leading-tight">{user?.full_name}</div>
                <div className="text-xs capitalize text-stone-warm">{user?.role}</div>
              </div>
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <DemoTour />
      </div>
    </div>
    </TourProvider>
  );
}

function NotificationButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const notes = useStore((d) => d.notifications.filter((n) => n.user_id === user?.id).slice().reverse().slice(0, 8));
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-full p-2 hover:bg-black/5" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {count > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-card border border-black/5 bg-white shadow-lift">
            <div className="border-b border-black/5 px-4 py-3 text-sm font-semibold">Notifications</div>
            {notes.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-warm">You're all caught up.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {notes.map((n) => (
                  <li key={n.id} className={cn('border-b border-black/5 px-4 py-3 last:border-0', !n.is_read && 'bg-primary-50/40')}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-stone-warm">{n.body}</p>}
                    {n.action_url && <NavLink to={n.action_url} onClick={() => setOpen(false)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">View <ExternalLink className="h-3 w-3" /></NavLink>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-warm">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
