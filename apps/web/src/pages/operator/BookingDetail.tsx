import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, FileText, Receipt, CalendarDays, Users2, MapPin } from 'lucide-react';
import { Card, CardBody, Badge, Button, EmptyState, Modal, Textarea } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { spaceName, renterName, profile } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange } from '../../lib/format.js';
import { bookingAction, createInvoiceFromBooking } from '../../lib/actions.js';
import { notifyError } from '../../lib/errors.js';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const booking = data.bookings.find((b) => b.id === id);
  const [denyOpen, setDenyOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!booking) return <EmptyState title="Booking not found" action={<Button asLink="/operator/bookings">Back to bookings</Button>} />;

  const renter = profile(data, booking.renter_id);
  const coi = data.compliance_docs.find((c) => c.booking_id === booking.id);
  const meta = BOOKING_STATUS_META[booking.status];

  async function act(action: 'approve' | 'deny' | 'complete', why?: string) {
    setBusy(true);
    try {
      await bookingAction(booking!.id, action, why);
      toast.success('Updated');
      setDenyOpen(false);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function invoice() {
    setBusy(true);
    try {
      const inv = await createInvoiceFromBooking(booking!.id);
      toast.success('Invoice created');
      if (inv) navigate('/operator/invoices');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/operator/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Bookings</Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{booking.event_name}</h1>
          <p className="mt-1 text-sm text-stone-warm">{spaceName(data, booking.space_id)}</p>
        </div>
        <Badge tone={meta.tone} className="self-start text-sm">{meta.label}</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card><CardBody className="space-y-4">
            <h2 className="font-semibold">Event details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail icon={CalendarDays} label="When" value={formatRange(booking.start_time, booking.end_time)} />
              <Detail icon={Users2} label="Expected attendance" value={`${booking.expected_attendance ?? '—'} guests`} />
              <Detail icon={MapPin} label="Space" value={spaceName(data, booking.space_id)} />
              <Detail icon={FileText} label="Event type" value={booking.event_type || '—'} />
            </div>
            {booking.event_description && <p className="text-sm text-ink/80">{booking.event_description}</p>}
            {booking.renter_notes && <div className="rounded-card bg-cream p-3 text-sm"><span className="font-medium">Renter note: </span>{booking.renter_notes}</div>}
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="font-semibold">Renter</h2>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{renterName(data, booking.renter_id)}</p>
                <p className="text-sm text-stone-warm">{renter?.email}</p>
              </div>
              <Link to="/operator/renters" className="text-sm font-medium text-primary hover:underline">View profile →</Link>
            </div>
          </CardBody></Card>
        </div>

        <div className="space-y-5">
          <Card><CardBody className="space-y-3">
            <h2 className="font-semibold">Pricing</h2>
            <Row label="Space subtotal" value={formatCents(booking.subtotal_cents - booking.resource_fees_cents + booking.discount_cents)} />
            {booking.resource_fees_cents > 0 && <Row label="Resources" value={formatCents(booking.resource_fees_cents)} />}
            {booking.discount_cents > 0 && <Row label="Discount" value={`−${formatCents(booking.discount_cents)}`} />}
            <div className="border-t border-black/5 pt-2"><Row label="Total" value={formatCents(booking.subtotal_cents)} bold /></div>
            <Row label="Platform fee (1.5%)" value={formatCents(booking.platform_fee_cents)} muted />
          </CardBody></Card>

          <Card><CardBody className="space-y-2">
            <h2 className="font-semibold">Compliance</h2>
            <div className="flex items-center justify-between text-sm">
              <span>Insurance (COI)</span>
              <Badge tone={coi?.status === 'approved' ? 'success' : coi ? 'warning' : 'neutral'}>{coi?.status || 'not uploaded'}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Use agreement</span>
              <Badge tone={booking.agreement_signed ? 'success' : 'neutral'}>{booking.agreement_signed ? 'signed' : 'pending'}</Badge>
            </div>
          </CardBody></Card>

          <div className="space-y-2">
            {booking.status === 'pending' && (
              <>
                <Button full loading={busy} onClick={() => act('approve')}><Check className="h-4 w-4" /> Approve request</Button>
                <Button full variant="outline" onClick={() => setDenyOpen(true)}><X className="h-4 w-4" /> Decline</Button>
              </>
            )}
            {['approved', 'confirmed'].includes(booking.status) && (
              <>
                <Button full variant="outline" loading={busy} onClick={invoice}><Receipt className="h-4 w-4" /> Create invoice</Button>
                {booking.status === 'confirmed' && <Button full variant="ghost" loading={busy} onClick={() => act('complete')}>Mark completed</Button>}
              </>
            )}
          </div>
        </div>
      </div>

      <Modal open={denyOpen} onClose={() => setDenyOpen(false)} title="Decline this request">
        <Textarea placeholder="Share a kind reason…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDenyOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => act('deny', reason)}>Decline</Button>
        </div>
      </Modal>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div><p className="text-xs text-stone-warm">{label}</p><p className="text-sm font-medium">{value}</p></div>
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${muted ? 'text-stone-warm' : ''}`}>
      <span className={bold ? 'font-semibold' : ''}>{label}</span>
      <span className={`tabular ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
