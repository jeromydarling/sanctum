import { Search, CalendarCheck, FileText, Settings } from 'lucide-react';
import { DashShell, type NavItem } from '../../components/dash/DashShell.js';

const NAV: NavItem[] = [
  { to: '/renter', label: 'Find a space', icon: Search, end: true },
  { to: '/renter/bookings', label: 'My bookings', icon: CalendarCheck },
  { to: '/renter/documents', label: 'My documents', icon: FileText },
  { to: '/renter/settings', label: 'Settings', icon: Settings },
];

export default function RenterLayout() {
  return <DashShell nav={NAV} title="Renter" />;
}
