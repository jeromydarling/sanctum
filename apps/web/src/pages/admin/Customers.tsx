import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat, Badge, Input, EmptyState } from '../../components/ui.js';
import { UsMap } from '../../components/UsMap.js';
import { openTasks } from '../../components/dash/AdminTimeline.js';
import { useStore } from '../../lib/store.js';
import { facilityForOperator, bookingsForFacility } from '../../lib/selectors.js';
import { formatCents, relativeDate, initials } from '../../lib/format.js';
import { PLAN_DETAILS } from '@sanctum/shared';
import type { StoreData } from '../../lib/mockData.js';
import { cn } from '../../lib/cn.js';

type Health = 'healthy' | 'at_risk' | 'new';
const REALIZED = ['confirmed', 'completed'];
const AT_RISK_STATUS = ['past_due', 'unpaid', 'canceled', 'paused'];

interface Customer {
  id: string; name: string; org: string | null; email: string;
  city: string; state: string; plan: string; status: string;
  gmv: number; mrr: number; bookings: number; lastActive: number; tasks: number; health: Health;
}

function buildCustomers(data: StoreData): Customer[] {
  return data.profiles
    .filter((p) => p.role === 'operator' || p.role === 'staff')
    .map((p) => {
      const facility = facilityForOperator(data, p.id);
      const realized = facility ? bookingsForFacility(data, facility.id).filter((b) => REALIZED.includes(b.status)) : [];
      const gmv = realized.reduce((s, b) => s + b.subtotal_cents, 0);
      const lastActive = realized.length ? Math.max(...realized.map((b) => +new Date(b.start_time))) : 0;
      const status = facility?.subscription_status || 'trialing';
      const tasks = openTasks(data, p.id);
      const dormant = lastActive > 0 && (Date.now() - lastActive) / 86_400_000 > 75;
      const health: Health = AT_RISK_STATUS.includes(status) || dormant ? 'at_risk' : realized.length === 0 ? 'new' : 'healthy';
      return {
        id: p.id, name: p.full_name || 'Unnamed', org: p.organization_name, email: p.email,
        city: facility?.city || '', state: (facility?.state || '').toUpperCase(),
        plan: facility?.plan || 'starter', status,
        gmv, mrr: facility ? PLAN_DETAILS[facility.plan].priceCents : 0,
        bookings: realized.length, lastActive, tasks, health,
      };
    });
}

const HEALTH_META: Record<Health, { label: string; tone: 'success' | 'danger' | 'gold' }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  at_risk: { label: 'At risk', tone: 'danger' },
  new: { label: 'New', tone: 'gold' },
};

export default function Customers() {
  const data = useStore((d) => d);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [health, setHealth] = useState<'all' | Health>('all');

  const customers = useMemo(() => buildCustomers(data), [data]);
  const filtered = customers.filter((c) => {
    if (health !== 'all' && c.health !== health) return false;
    if (!q.trim()) return true;
    const hay = `${c.name} ${c.org || ''} ${c.email} ${c.city} ${c.state}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }).sort((a, b) => b.gmv - a.gmv);

  const mrr = customers.reduce((s, c) => s + c.mrr, 0);
  const gmv = customers.reduce((s, c) => s + c.gmv, 0);
  const atRisk = customers.filter((c) => c.health === 'at_risk').length;

  // One pin per state, sized by customer count.
  const byState = new Map<string, number>();
  for (const c of filtered) if (c.state) byState.set(c.state, (byState.get(c.state) || 0) + 1);
  const pins = [...byState.entries()].map(([state, count]) => ({
    id: state, state, count, label: `${state} · ${count} customer${count !== 1 ? 's' : ''}`,
    onClick: () => setQ(state),
  }));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Every community on Sanctum — health, activity, and where they are." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={customers.length} sub="operators & staff" />
        <Stat label="Subscription MRR" value={formatCents(mrr)} sub={`${formatCents(mrr * 12)} ARR`} tone="success" />
        <Stat label="GMV (all time)" value={formatCents(gmv)} sub="booked through Sanctum" tone="primary" />
        <Stat label="At risk" value={atRisk} sub="need attention" tone={atRisk ? 'danger' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-warm" />
              <Input className="pl-9" placeholder="Search name, org, email, city…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'healthy', 'at_risk', 'new'] as const).map((h) => (
                <button key={h} onClick={() => setHealth(h)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition', health === h ? 'border-primary bg-primary-50 text-primary-700' : 'border-black/10 text-ink/70 hover:border-primary/30')}>
                  {h === 'all' ? 'All' : HEALTH_META[h].label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            {filtered.length === 0 ? (
              <div className="p-5"><EmptyState icon={<UserRound className="h-8 w-8" />} title="No customers match" body="Try a different search or filter." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-black/5 bg-cream text-left text-xs text-stone-warm">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Customer</th>
                      <th className="px-4 py-2.5 font-medium">Location</th>
                      <th className="px-4 py-2.5 font-medium">Plan</th>
                      <th className="px-4 py-2.5 text-right font-medium">GMV</th>
                      <th className="px-4 py-2.5 text-right font-medium">Bookings</th>
                      <th className="px-4 py-2.5 font-medium">Last active</th>
                      <th className="px-4 py-2.5 font-medium">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {filtered.map((c) => (
                      <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="cursor-pointer transition hover:bg-black/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(c.name)}</span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{c.org || c.name}</p>
                              <p className="truncate text-xs text-stone-warm">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-warm">{c.city ? `${c.city}, ${c.state}` : '—'}</td>
                        <td className="px-4 py-3"><Badge tone="primary">{PLAN_DETAILS[c.plan as keyof typeof PLAN_DETAILS]?.name || c.plan}</Badge></td>
                        <td className="tabular px-4 py-3 text-right font-medium">{formatCents(c.gmv)}</td>
                        <td className="tabular px-4 py-3 text-right">{c.bookings}</td>
                        <td className="px-4 py-3 text-stone-warm">{c.lastActive ? relativeDate(new Date(c.lastActive).toISOString()) : 'never'}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <Badge tone={HEALTH_META[c.health].tone}>{HEALTH_META[c.health].label}</Badge>
                            {c.tasks > 0 && <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> {c.tasks}</Badge>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card><CardBody>
            <h3 className="font-semibold">Where they are</h3>
            <p className="mb-3 text-xs text-stone-warm">Tap a state to filter.</p>
            <UsMap pins={pins} />
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}
