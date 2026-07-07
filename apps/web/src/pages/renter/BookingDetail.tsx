import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, CalendarDays, Users2, Star, ShieldCheck } from 'lucide-react';
import { Card, CardBody, Badge, Button, EmptyState, Modal, Textarea, Input } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { spaceName, facilityName } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange } from '../../lib/format.js';
import { payBooking, bookingAction } from '../../lib/actions.js';
import { notifyError } from '../../lib/errors.js';
import { genId } from '../../lib/ids.js';
import { cn } from '../../lib/cn.js';

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const booking = data.bookings.find((b) => b.id === id);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (!booking) return <EmptyState title="Booking not found" action={<Button asLink="/renter/bookings">My bookings</Button>} />;
  const meta = BOOKING_STATUS_META[booking.status];
  const existingReview = data.reviews.find((r) => r.booking_id === booking.id);

  async function pay() {
    setBusy(true);
    try { await payBooking(booking!.id); toast.success('Payment confirmed — you\'re booked!'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await bookingAction(booking!.id, 'cancel'); toast.success('Booking cancelled'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/renter/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> My bookings</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{booking.event_name}</h1>
          <p className="mt-1 text-sm text-stone-warm">{spaceName(data, booking.space_id)} · {facilityName(data, booking.facility_id)}</p>
        </div>
        <Badge tone={meta.tone} className="text-sm">{meta.label}</Badge>
      </div>

      {booking.status === 'approved' && (
        <Card className="mt-5 border-primary/20 bg-primary-50/50"><CardBody className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-primary-700">Approved — ready to confirm</p>
            <p className="text-sm text-stone-warm">Pay {formatCents(booking.subtotal_cents + (booking.deposit_cents || 0))}{(booking.deposit_cents || 0) > 0 ? ` (incl. ${formatCents(booking.deposit_cents)} refundable deposit)` : ''} to lock in your date.</p>
          </div>
          <Button loading={busy} onClick={pay}><CreditCard className="h-4 w-4" /> Pay & confirm</Button>
        </CardBody></Card>
      )}
      {booking.status === 'denied' && booking.denial_reason && (
        <Card className="mt-5"><CardBody><p className="text-sm"><span className="font-medium">A note from the host: </span>{booking.denial_reason}</p></CardBody></Card>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Card><CardBody className="space-y-3">
          <h2 className="font-semibold">Details</h2>
          <Detail icon={CalendarDays} label="When" value={formatRange(booking.start_time, booking.end_time)} />
          <Detail icon={Users2} label="Attendance" value={`${booking.expected_attendance ?? '—'} guests`} />
          {booking.event_description && <p className="text-sm text-ink/80">{booking.event_description}</p>}
        </CardBody></Card>
        <Card><CardBody className="space-y-2">
          <h2 className="font-semibold">Pricing</h2>
          <Row label="Total" value={formatCents(booking.subtotal_cents)} bold />
          {(booking.deposit_cents || 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span>Deposit{booking.deposit_status === 'held' ? ' (refundable)' : ''}</span>
              <span className="flex items-center gap-2">
                <span className="tabular">{formatCents(booking.deposit_cents)}</span>
                <Badge tone={booking.deposit_status === 'returned' ? 'success' : booking.deposit_status === 'withheld' ? 'warning' : booking.deposit_status === 'held' ? 'gold' : 'neutral'}>{booking.deposit_status || 'none'}</Badge>
              </span>
            </div>
          )}
          {booking.deposit_status === 'withheld' && booking.deposit_resolution_note && (
            <p className="rounded-card bg-cream px-2.5 py-2 text-xs text-stone-warm">Refunded {formatCents(booking.deposit_returned_cents || 0)} of your deposit. Note: {booking.deposit_resolution_note}</p>
          )}
          <Row label="Platform fee (1.5%)" value={formatCents(booking.platform_fee_cents)} muted />
          <p className="flex items-start gap-1.5 pt-1 text-xs text-stone-warm"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary/60" /> Shown transparently, never hidden.</p>
        </CardBody></Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {['pending', 'approved', 'confirmed'].includes(booking.status) && new Date(booking.start_time) > new Date() && (
          <Button variant="ghost" className="text-danger hover:bg-danger/5" loading={busy} onClick={cancel}>Cancel booking</Button>
        )}
        {booking.status === 'completed' && !existingReview && (
          <Button variant="outline" onClick={() => setReviewOpen(true)}><Star className="h-4 w-4" /> Leave a review</Button>
        )}
        {existingReview && <Badge tone="success"><Star className="h-3.5 w-3.5" /> You reviewed this</Badge>}
      </div>

      {reviewOpen && <ReviewModal booking={booking} renterId={user!.id} onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

function ReviewModal({ booking, renterId, onClose }: { booking: import('@sanctum/shared').Booking; renterId: string; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await wt('reviews', {
        id: genId('rev'), booking_id: booking.id, facility_id: booking.facility_id, space_id: booking.space_id,
        renter_id: renterId, rating, headline: headline || null, body: body || null, is_published: 1,
        operator_response: null, created_at: now, updated_at: now,
      });
      toast.success('Thank you for your review!');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="How was your event?">
      <div className="space-y-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n === rating} onClick={() => setRating(n)}><Star className={cn('h-8 w-8', n <= rating ? 'fill-gold text-gold' : 'text-black/15')} /></button>
          ))}
        </div>
        <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="A wonderful space" />
        <Textarea label="Your review" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share how it went…" />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Post review</Button></div>
      </div>
    </Modal>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-xs text-stone-warm">{label}</p><p className="text-sm font-medium">{value}</p></div></div>;
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return <div className={cn('flex justify-between text-sm', muted && 'text-stone-warm')}><span className={bold ? 'font-semibold' : ''}>{label}</span><span className={cn('tabular', bold && 'font-bold')}>{value}</span></div>;
}
