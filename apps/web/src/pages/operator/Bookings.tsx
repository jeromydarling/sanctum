import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Inbox, Check, X, Plus } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Badge, Button, EmptyState, Modal, Textarea, Input, Select } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, bookingsForFacility, spaceName, renterName } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange, relativeDate } from '../../lib/format.js';
import { bookingAction, createBooking } from '../../lib/actions.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';

type Tab = 'pending' | 'upcoming' | 'past';

export default function Bookings() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [tab, setTab] = useState<Tab>('pending');
  const [denyId, setDenyId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (!facility) return <EmptyState title="No facility yet" />;
  const all = bookingsForFacility(data, facility.id);
  const now = Date.now();
  const buckets: Record<Tab, typeof all> = {
    pending: all.filter((b) => b.status === 'pending'),
    upcoming: all.filter((b) => ['approved', 'confirmed'].includes(b.status) && new Date(b.start_time).getTime() >= now),
    past: all.filter((b) => ['completed', 'denied', 'cancelled', 'no_show'].includes(b.status) || new Date(b.start_time).getTime() < now),
  };
  const list = buckets[tab];

  async function act(id: string, action: 'approve' | 'deny', why?: string) {
    setBusy(id);
    try {
      await bookingAction(id, action, why);
      toast.success(action === 'approve' ? 'Booking approved' : 'Request declined');
      setDenyId(null);
      setReason('');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Review requests and manage your calendar of events." action={<Button data-tour="op-bookings-add" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add booking</Button>} />
      <div className="mb-5 inline-flex rounded-card border border-black/10 bg-white p-1" data-tour="op-bookings-tabs">
        {(['pending', 'upcoming', 'past'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-[6px] px-4 py-1.5 text-sm font-medium capitalize transition', tab === t ? 'bg-primary text-white' : 'text-ink/70 hover:bg-black/[0.03]')}>
            {t} {buckets[t].length > 0 && <span className="ml-1 opacity-70">{buckets[t].length}</span>}
          </button>
        ))}
      </div>

      <div data-tour="op-bookings-list">
      {list.length === 0 ? (
        <EmptyState icon={<Inbox className="h-8 w-8" />} title={`No ${tab} bookings`} body={tab === 'pending' ? 'New requests will show up here for your review.' : 'Nothing here yet.'} />
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <Card key={b.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link to={`/operator/bookings/${b.id}`} className="min-w-0 flex-1 group">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold group-hover:text-primary">{b.event_name}</p>
                    <Badge tone={BOOKING_STATUS_META[b.status].tone}>{BOOKING_STATUS_META[b.status].label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-warm">{renterName(data, b.renter_id)} · {spaceName(data, b.space_id)}</p>
                  <p className="mt-0.5 text-xs text-stone-warm">{formatRange(b.start_time, b.end_time)} · {relativeDate(b.start_time)} · {b.expected_attendance ?? '—'} guests</p>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="tabular font-semibold text-primary-700">{formatCents(b.subtotal_cents)}</span>
                  {b.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDenyId(b.id)} disabled={busy === b.id}><X className="h-4 w-4" /> Decline</Button>
                      <Button size="sm" loading={busy === b.id} onClick={() => act(b.id, 'approve')}><Check className="h-4 w-4" /> Approve</Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>

      {addOpen && facility && <ManualBookingModal facilityId={facility.id} operatorId={user!.id} spaces={data.spaces.filter((s) => s.facility_id === facility.id)} onClose={() => setAddOpen(false)} />}

      <Modal open={!!denyId} onClose={() => setDenyId(null)} title="Decline this request">
        <p className="text-sm text-stone-warm">Let the renter know why — they'll receive a kind note with your reason.</p>
        <Textarea className="mt-3" placeholder="We have a conflict that day, but we'd love to host you another time…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDenyId(null)}>Cancel</Button>
          <Button variant="danger" loading={busy === denyId} onClick={() => denyId && act(denyId, 'deny', reason)}>Decline request</Button>
        </div>
      </Modal>
    </div>
  );
}

function ManualBookingModal({ facilityId, operatorId, spaces, onClose }: { facilityId: string; operatorId: string; spaces: import('@sanctum/shared').Space[]; onClose: () => void }) {
  const [form, setForm] = useState({ space_id: spaces[0]?.id || '', event_name: '', walkin_name: '', date: '', start: '10:00', end: '14:00', attendance: '' });
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!form.space_id || !form.event_name.trim() || !form.date) { toast.error('Fill in the space, event name, and date'); return; }
    setBusy(true);
    try {
      await createBooking({
        facility_id: facilityId, space_id: form.space_id, event_name: form.event_name,
        expected_attendance: form.attendance ? Number(form.attendance) : undefined,
        start_time: new Date(`${form.date}T${form.start}:00`).toISOString(),
        end_time: new Date(`${form.date}T${form.end}:00`).toISOString(),
        manual: true, walkin_name: form.walkin_name,
      }, operatorId);
      toast.success('Booking added to your calendar');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add a booking">
      <div className="space-y-3">
        <p className="text-sm text-stone-warm">For a walk-in or a renter you booked offline. It's added as confirmed.</p>
        <Select label="Space" value={form.space_id} onChange={(e) => setForm({ ...form, space_id: e.target.value })}>
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Event name" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} placeholder="Smith Family Reunion" />
          <Input label="Renter name" value={form.walkin_name} onChange={(e) => setForm({ ...form, walkin_name: e.target.value })} placeholder="Pat Smith" />
        </div>
        <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="From" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <Input label="To" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <Input label="Guests" type="number" value={form.attendance} onChange={(e) => setForm({ ...form, attendance: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={create}>Add booking</Button></div>
      </div>
    </Modal>
  );
}
