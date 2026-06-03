import { LayoutDashboard, Building2, Users, AlertTriangle } from 'lucide-react';
import { DashShell, type NavItem } from '../../components/dash/DashShell.js';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/facilities', label: 'Facilities', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/errors', label: 'Error log', icon: AlertTriangle },
];

export default function AdminLayout() {
  return <DashShell nav={NAV} title="Platform Admin" />;
}
