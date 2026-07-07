import { LayoutDashboard, Building2, Users, AlertTriangle, Megaphone, Network, UserRound } from 'lucide-react';
import { DashShell, type NavItem } from '../../components/dash/DashShell.js';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customers', icon: UserRound },
  { to: '/admin/facilities', label: 'Facilities', icon: Building2 },
  { to: '/admin/networks', label: 'Networks', icon: Network },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/errors', label: 'Error log', icon: AlertTriangle },
];

export default function AdminLayout() {
  return <DashShell nav={NAV} title="Platform Admin" />;
}
