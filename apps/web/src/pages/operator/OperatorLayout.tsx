import {
  LayoutDashboard, CalendarDays, Inbox, Building2, ShieldCheck,
  FileText, Users, Sparkles, BarChart3, Settings, Megaphone, Star, Tag, Repeat, Network, Calculator,
} from 'lucide-react';
import { DashShell, type NavItem } from '../../components/dash/DashShell.js';

const NAV: NavItem[] = [
  { to: '/operator', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/operator/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/operator/bookings', label: 'Bookings', icon: Inbox },
  { to: '/operator/spaces', label: 'Spaces & Resources', icon: Building2 },
  { to: '/operator/tenants', label: 'Tenants & recurring', icon: Repeat },
  { to: '/operator/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/operator/pricing', label: 'Pricing & discounts', icon: Tag },
  { to: '/operator/invoices', label: 'Invoices', icon: FileText },
  { to: '/operator/renters', label: 'Renters', icon: Users },
  { to: '/operator/leads', label: 'Inquiries', icon: Megaphone },
  { to: '/operator/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/operator/financials', label: 'Financials', icon: Calculator },
  { to: '/operator/reviews', label: 'Reviews', icon: Star },
  { to: '/operator/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/operator/network', label: 'Network', icon: Network },
  { to: '/operator/settings', label: 'Settings', icon: Settings },
];

export default function OperatorLayout() {
  return <DashShell nav={NAV} title="Operator" />;
}
