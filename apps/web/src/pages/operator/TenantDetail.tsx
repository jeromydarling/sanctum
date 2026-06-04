import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Pencil, CalendarClock, Calendar } from 'lucide-react';
import { Card, CardBody, Button, Badge, Stat, EmptyState } from '../../components/ui.js';
import { CrmTimeline, openReminders } from '../../components/CrmTimeline.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName } from '../../lib/selectors.js';
import { formatCents, formatDate, formatTime } from '../../lib/format.js';
import { leaseOccurrences, leaseMonthlyAmountCents } from '@sanctum/shared';
import { LeaseEditor } from './Tenants.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TenantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const lease = data.leases.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);

  if (!facility || !lease) return <EmptyState title="Tenant not found" action={<Button asLink="/operator/tenants">Back to tenants</Button>} />;

  const now = new Date();
  const reminders = openReminders(data, 'lease', lease.id);
  const monthly = leaseMonthlyAmountCents(lease, now.getUTCFullYear(), now.getUTCMonth());
  const upcoming = leaseOccurrences(lease, now, new Date(now.getTime() + 28 * 86400000)).slice(0, 6);
  const next = upcoming[0];

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/operator/tenants" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Tenants</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{lease.title}</h1>
            <Badge tone={lease.status === 'active' ? 'success' : lease.status === 'paused' ? 'warning' : 'neutral'}>{lease.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-stone-warm">{lease.tenant_name ? `${lease.tenant_name} · ` : ''}{spaceName(data, lease.space_id)}</p>
        </div>
        <div className="flex gap-2">
          {lease.tenant_email && <Button variant="outline" size="sm" onClick={() => { window.location.href = `mailto:${lease.tenant_email}`; }}><Mail className="h-4 w-4" /> Email</Button>}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit terms</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Each month" value={formatCents(monthly)} sub={lease.rate_period === 'month' ? 'flat' : 'this month'} tone="success" />
        <Stat label="Over a year" value={formatCents(monthly * 12)} tone="primary" />
        <Stat label="Reminders" value={reminders} sub={next ? `next gathering ${formatDate(next.start)}` : 'no upcoming gatherings'} tone={reminders ? 'gold' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CrmTimeline facilityId={facility.id} subjectKind="lease" subjectId={lease.id} userId={user!.id} placeholder={`Write down a note about ${lease.tenant_name || lease.title}…`} />
        </div>

        <div className="space-y-5">
          <Card><CardBody className="space-y-2">
            <h2 className="font-semibold">The arrangement</h2>
            <Row label="Space" value={spaceName(data, lease.space_id)} />
            <Row label="Rhythm" value={lease.cadence} />
            {lease.cadence !== 'monthly' && <Row label="Days" value={lease.weekdays.map((w) => DOW[w]).join(', ') || '—'} />}
            <Row label="Time" value={`${lease.start_time_local}–${lease.end_time_local}`} />
            <Row label="Contribution" value={`${formatCents(lease.rate_cents)} / ${lease.rate_period === 'month' ? 'month' : 'gathering'}`} />
            <Row label="Since" value={formatDate(lease.start_date)} />
            <Row label="Until" value={lease.end_date ? formatDate(lease.end_date) : 'Ongoing'} />
            {lease.notes && <p className="rounded-card bg-cream p-2.5 text-xs text-stone-warm">{lease.notes}</p>}
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming gatherings</h2>
            <div className="mt-3 space-y-2">
              {upcoming.length === 0 ? <p className="text-sm text-stone-warm">None in the next four weeks.</p> : upcoming.map((o, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-stone-warm" />
                  <span>{formatDate(o.start)} · {formatTime(o.start)}–{formatTime(o.end)}</span>
                </div>
              ))}
            </div>
          </CardBody></Card>
        </div>
      </div>

      {editing && <LeaseEditor facilityId={facility.id} spaces={data.spaces.filter((s) => s.facility_id === facility.id)} lease={lease} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 text-sm"><span className="text-stone-warm">{label}</span><span className="font-medium capitalize">{value}</span></div>;
}
