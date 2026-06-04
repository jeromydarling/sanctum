import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Pencil, CalendarClock, StickyNote, Phone, MapPin, Calendar,
  CheckSquare, Square, Plus, AlertCircle,
} from 'lucide-react';
import { Card, CardBody, Button, Badge, Stat, Textarea, Input, EmptyState } from '../../components/ui.js';
import { useStore, wt, remove } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName } from '../../lib/selectors.js';
import { formatCents, formatDate, formatTime } from '../../lib/format.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import {
  leaseOccurrences, leaseMonthlyAmountCents, type TenantInteraction, type Lease,
} from '@sanctum/shared';
import { LeaseEditor } from './Tenants.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_META: Record<TenantInteraction['kind'], { icon: typeof StickyNote; label: string; tone: string }> = {
  note: { icon: StickyNote, label: 'Note', tone: 'bg-primary-50 text-primary-700' },
  call: { icon: Phone, label: 'Call', tone: 'bg-gold/15 text-gold-dark' },
  email: { icon: Mail, label: 'Email', tone: 'bg-[#e0e3ff] text-primary-700' },
  visit: { icon: MapPin, label: 'Visit', tone: 'bg-success/10 text-success' },
  task: { icon: CheckSquare, label: 'Task', tone: 'bg-warning/15 text-[#8a5a00]' },
};

export default function TenantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const lease = data.leases.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);

  if (!facility || !lease) return <EmptyState title="Tenant not found" action={<Button asLink="/operator/tenants">Back to tenants</Button>} />;

  const now = new Date();
  const interactions = data.tenant_interactions
    .filter((t) => t.lease_id === lease.id)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const openTasks = interactions.filter((t) => t.kind === 'task' && !t.done);
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
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit lease</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Monthly value" value={formatCents(monthly)} sub={lease.rate_period === 'month' ? 'flat' : 'this month'} tone="success" />
        <Stat label="Projected annual" value={formatCents(monthly * 12)} tone="primary" />
        <Stat label="Open follow-ups" value={openTasks.length} sub={next ? `next session ${formatDate(next.start)}` : 'no upcoming sessions'} tone={openTasks.length ? 'gold' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="space-y-5 lg:col-span-2">
          <Composer lease={lease} facilityId={facility.id} userId={user!.id} />
          <Card><CardBody>
            <h2 className="font-semibold">Relationship history</h2>
            {interactions.length === 0 ? (
              <p className="mt-3 text-sm text-stone-warm">No notes yet — log your first call, visit, or note above.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {interactions.map((t) => {
                  const meta = KIND_META[t.kind];
                  const overdue = t.kind === 'task' && !t.done && t.due_at && new Date(t.due_at) < now;
                  return (
                    <li key={t.id} className="flex gap-3">
                      <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', meta.tone)}><meta.icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-stone-warm">{meta.label}</span>
                          <span className="text-xs text-stone-warm">{formatDate(t.created_at)}</span>
                          {overdue && <Badge tone="danger"><AlertCircle className="h-3 w-3" /> overdue</Badge>}
                        </div>
                        <p className={cn('mt-0.5 text-sm', t.done === 1 && 'text-stone-warm line-through')}>{t.body}</p>
                        {t.kind === 'task' && t.due_at && (
                          <p className="mt-0.5 text-xs text-stone-warm">Due {formatDate(t.due_at)}</p>
                        )}
                        <div className="mt-1 flex items-center gap-3">
                          {t.kind === 'task' && (
                            <button onClick={() => wt('tenant_interactions', { ...t, done: t.done ? 0 : 1 })} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              {t.done ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />} {t.done ? 'Reopen' : 'Mark done'}
                            </button>
                          )}
                          <button onClick={() => remove('tenant_interactions', t.id)} className="text-xs text-stone-warm hover:text-danger">Delete</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody></Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card><CardBody className="space-y-2">
            <h2 className="font-semibold">Lease terms</h2>
            <Row label="Space" value={spaceName(data, lease.space_id)} />
            <Row label="Repeats" value={lease.cadence} />
            {lease.cadence !== 'monthly' && <Row label="Days" value={lease.weekdays.map((w) => DOW[w]).join(', ') || '—'} />}
            <Row label="Time" value={`${lease.start_time_local}–${lease.end_time_local}`} />
            <Row label="Rate" value={`${formatCents(lease.rate_cents)} / ${lease.rate_period === 'month' ? 'month' : 'session'}`} />
            <Row label="Start" value={formatDate(lease.start_date)} />
            <Row label="End" value={lease.end_date ? formatDate(lease.end_date) : 'Ongoing'} />
            {lease.notes && <p className="rounded-card bg-cream p-2.5 text-xs text-stone-warm">{lease.notes}</p>}
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming sessions</h2>
            <div className="mt-3 space-y-2">
              {upcoming.length === 0 ? <p className="text-sm text-stone-warm">No sessions in the next 4 weeks.</p> : upcoming.map((o, i) => (
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

function Composer({ lease, facilityId, userId }: { lease: Lease; facilityId: string; userId: string }) {
  const [kind, setKind] = useState<TenantInteraction['kind']>('note');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) { toast.error('Add a few words'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await wt('tenant_interactions', {
        id: genId('ti'), facility_id: facilityId, lease_id: lease.id, kind, body: body.trim(),
        due_at: kind === 'task' && due ? new Date(`${due}T12:00:00`).toISOString() : null,
        done: 0, created_by: userId, created_at: now, updated_at: now,
      });
      setBody(''); setDue('');
      toast.success('Logged');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Card><CardBody className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_META) as TenantInteraction['kind'][]).map((k) => {
          const meta = KIND_META[k];
          return (
            <button key={k} onClick={() => setKind(k)} className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition', kind === k ? 'border-primary bg-primary-50 text-primary-700' : 'border-black/10 text-ink/70 hover:border-primary/30')}>
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === 'task' ? 'What needs following up?' : kind === 'call' ? 'What did you talk about?' : 'Log a note about this tenant…'} />
      <div className="flex items-center justify-between gap-3">
        {kind === 'task'
          ? <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="max-w-44" />
          : <span />}
        <Button loading={busy} onClick={add}><Plus className="h-4 w-4" /> Log {KIND_META[kind].label.toLowerCase()}</Button>
      </div>
    </CardBody></Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 text-sm"><span className="text-stone-warm">{label}</span><span className="font-medium capitalize">{value}</span></div>;
}
