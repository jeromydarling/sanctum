import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Inbox, Check, X } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Badge, Button, EmptyState, Modal, Textarea } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, bookingsForFacility, spaceName, renterName } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange, relativeDate } from '../../lib/format.js';
import { bookingAction } from '../../lib/actions.js';
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
      <PageHeader title="Bookings" subtitle="Review requests and manage your calendar of events." />
      <div className="mb-5 inline-flex rounded-card border border-black/10 bg-white p-1">
        {(['pending', 'upcoming', 'past'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-[6px] px-4 py-1.5 text-sm font-medium capitalize transition', tab === t ? 'bg-primary text-white' : 'text-ink/70 hover:bg-black/[0.03]')}>
            {t} {buckets[t].length > 0 && <span className="ml-1 opacity-70">{buckets[t].length}</span>}
          </button>
        ))}
      </div>

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
