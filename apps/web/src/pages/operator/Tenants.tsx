import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Repeat, Pencil, Trash2, CalendarClock } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Badge, Input, Select, Textarea, Modal, EmptyState, Stat } from '../../components/ui.js';
import { useStore, wt, remove } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName } from '../../lib/selectors.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { formatDate, formatTime } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';
import {
  formatCents, parseDollarsToCents, leaseOccurrences, leaseMonthlyAmountCents, type Lease,
} from '@sanctum/shared';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Tenants() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [creating, setCreating] = useState(false);

  if (!facility) return <EmptyState title="No facility yet" />;
  const leases = data.leases.filter((l) => l.facility_id === facility.id);
  const now = new Date();
  const monthlyRecurring = leases
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + leaseMonthlyAmountCents(l, now.getUTCFullYear(), now.getUTCMonth()), 0);
  const leaseIds = new Set(leases.map((l) => l.id));
  const openTasksByLease = (leaseId: string) => data.crm_interactions.filter((t) => t.subject_kind === 'lease' && t.subject_id === leaseId && t.kind === 'reminder' && !t.done).length;
  const dueFollowUps = data.crm_interactions.filter((t) => t.subject_kind === 'lease' && leaseIds.has(t.subject_id) && t.kind === 'reminder' && !t.done).length;

  return (
    <div>
      <PageHeader
        title="Tenants & recurring"
        subtitle="The groups who make your spaces a second home — held on your calendar and invoiced each month, so you can focus on the relationship."
        action={<Button data-tour="op-tenants-add" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add tenant</Button>}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3" data-tour="op-tenants-stats">
        <Stat label="From tenants each month" value={formatCents(monthlyRecurring)} sub="invoiced automatically" tone="success" />
        <Stat label="Active tenants" value={leases.filter((l) => l.status === 'active').length} tone="primary" />
        <Stat label="Reminders" value={dueFollowUps} sub="people to check in with" tone={dueFollowUps ? 'gold' : 'neutral'} />
      </div>

      <div data-tour="op-tenants-list">
      {leases.length === 0 ? (
        <EmptyState icon={<Repeat className="h-8 w-8" />} title="No recurring tenants yet" body="Add a weekly group, a class, or a long-term tenant — Sanctum holds the time on your calendar and invoices them every month." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add a tenant</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leases.map((l) => {
            const next = leaseOccurrences(l, now, new Date(now.getTime() + 14 * 86400000))[0];
            const monthly = leaseMonthlyAmountCents(l, now.getUTCFullYear(), now.getUTCMonth());
            const openTasks = openTasksByLease(l.id);
            return (
              <Card key={l.id}><CardBody>
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/operator/tenants/${l.id}`} className="group">
                    <h3 className="font-semibold group-hover:text-primary">{l.title}</h3>
                    <p className="text-xs text-stone-warm">{spaceName(data, l.space_id)}{l.tenant_name ? ` · ${l.tenant_name}` : ''}</p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={l.status === 'active' ? 'success' : l.status === 'paused' ? 'warning' : 'neutral'}>{l.status}</Badge>
                    {openTasks > 0 && <Badge tone="gold">{openTasks} reminder{openTasks !== 1 ? 's' : ''}</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {l.cadence !== 'monthly' ? l.weekdays.map((w) => <span key={w} className="rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700">{DOW[w]}</span>)
                    : <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700">Monthly</span>}
                  <span className="text-[11px] text-stone-warm">· {l.start_time_local}–{l.end_time_local} · {l.cadence}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
                  <span className="text-stone-warm">{l.rate_period === 'month' ? 'Monthly' : 'Per session'}: <span className="tabular font-semibold text-ink">{formatCents(l.rate_cents)}</span></span>
                  <span className="tabular font-semibold text-success">{formatCents(monthly)}/mo</span>
                </div>
                {next && <p className="mt-2 flex items-center gap-1 text-xs text-stone-warm"><CalendarClock className="h-3.5 w-3.5" /> Next: {formatDate(next.start)} · {formatTime(next.start)}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" full asLink={`/operator/tenants/${l.id}`}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/5" onClick={() => remove('leases', l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardBody></Card>
            );
          })}
        </div>
      )}
      </div>

      {(creating || editing) && (
        <LeaseEditor facilityId={facility.id} spaces={data.spaces.filter((s) => s.facility_id === facility.id)} lease={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </div>
  );
}

export function LeaseEditor({ facilityId, spaces, lease, onClose }: { facilityId: string; spaces: import('@sanctum/shared').Space[]; lease: Lease | null; onClose: () => void }) {
  const isNew = !lease;
  const [form, setForm] = useState<Lease>(lease || blankLease(facilityId, spaces[0]?.id || ''));
  const [busy, setBusy] = useState(false);
  function set<K extends keyof Lease>(k: K, v: Lease[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleDay(d: number) {
    set('weekdays', form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort());
  }

  async function save() {
    if (!form.title.trim()) { toast.error('Give this tenant a name'); return; }
    if (!form.space_id) { toast.error('Choose a space'); return; }
    if (form.cadence !== 'monthly' && form.weekdays.length === 0) { toast.error('Pick at least one day'); return; }
    setBusy(true);
    try {
      await wt('leases', { ...form, updated_at: new Date().toISOString() });
      toast.success(isNew ? 'Tenant added' : 'Tenant updated');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add a recurring tenant' : 'Edit tenant'} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name / title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Little Lambs Daycare" />
          <Select label="Space" value={form.space_id} onChange={(e) => set('space_id', e.target.value)}>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Contact name (optional)" value={form.tenant_name || ''} onChange={(e) => set('tenant_name', e.target.value)} />
          <Input label="Contact email (optional)" type="email" value={form.tenant_email || ''} onChange={(e) => set('tenant_email', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Repeats" value={form.cadence} onChange={(e) => set('cadence', e.target.value as Lease['cadence'])}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every other week</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Input label="From" type="time" value={form.start_time_local} onChange={(e) => set('start_time_local', e.target.value)} />
          <Input label="To" type="time" value={form.end_time_local} onChange={(e) => set('end_time_local', e.target.value)} />
        </div>
        {form.cadence !== 'monthly' && (
          <div>
            <span className="mb-1.5 block text-sm font-medium">On these days</span>
            <div className="flex gap-1.5">
              {DOW.map((d, i) => (
                <button key={d} onClick={() => toggleDay(i)} className={cn('h-9 w-11 rounded-card border text-xs font-medium transition', form.weekdays.includes(i) ? 'border-primary bg-primary text-white' : 'border-black/10 hover:border-primary/40')}>{d}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Start date" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
          <Input label="End date (optional, blank = ongoing)" type="date" value={form.end_date || ''} onChange={(e) => set('end_date', e.target.value || null)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Rate ($)" defaultValue={form.rate_cents ? (form.rate_cents / 100).toString() : ''} onBlur={(e) => set('rate_cents', parseDollarsToCents(e.target.value))} placeholder="1200" />
          <Select label="Billed" value={form.rate_period} onChange={(e) => set('rate_period', e.target.value as Lease['rate_period'])}>
            <option value="month">Flat per month</option>
            <option value="session">Per session</option>
          </Select>
        </div>
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as Lease['status'])}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </Select>
        <Textarea label="Notes (optional)" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        <p className="text-xs text-stone-warm">Active tenants hold their time on your public calendar (no one else can book it) and are invoiced automatically each month.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{isNew ? 'Add tenant' : 'Save changes'}</Button></div>
      </div>
    </Modal>
  );
}

function blankLease(facilityId: string, spaceId: string): Lease {
  const now = new Date().toISOString();
  return {
    id: genId('lease'), facility_id: facilityId, space_id: spaceId, renter_id: null,
    title: '', tenant_name: '', tenant_email: '', cadence: 'weekly', weekdays: [1],
    start_time_local: '18:00', end_time_local: '20:00', start_date: now.slice(0, 10), end_date: null,
    rate_cents: 0, rate_period: 'month', status: 'active', notes: '', created_at: now, updated_at: now,
  };
}
