import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Users2, ShieldCheck } from 'lucide-react';
import { Card, CardBody, Button, Input, Textarea, Badge, Spinner, EmptyState } from '../../components/ui.js';
import { SmartImage } from '../../components/SmartImage.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { createBooking } from '../../lib/actions.js';
import { notifyError } from '../../lib/errors.js';
import {
  computeBookingPrice, durationMinutes, formatCents,
  SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI, type SpaceType,
} from '@sanctum/shared';
import { cn } from '../../lib/cn.js';

interface Space {
  id: string; name: string; space_type: SpaceType; description: string | null; capacity_persons: number | null;
  hourly_rate_cents: number; half_day_rate_cents: number | null; full_day_rate_cents: number | null;
  weekend_hourly_rate_cents: number | null; deposit_amount_cents: number; images: string[]; amenities: string[]; buffer_minutes: number;
}
interface Facility { id: string; name: string; slug: string; spaces: Space[]; require_coi?: number; }

export default function BookingFlow() {
  const { facilityId, spaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    date: '', start: '10:00', end: '14:00', event_name: '', event_type: 'community',
    expected_attendance: '', event_description: '', renter_notes: '', agree: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ facilities: Facility[] }>('/public/discover', { auth: false });
        const f = data.facilities.find((x) => x.id === facilityId);
        const s = f?.spaces.find((x) => x.id === spaceId) || null;
        setFacility(f || null); setSpace(s);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [facilityId, spaceId]);

  const startISO = form.date ? new Date(`${form.date}T${form.start}:00`).toISOString() : '';
  const endISO = form.date ? new Date(`${form.date}T${form.end}:00`).toISOString() : '';

  const price = useMemo(() => {
    if (!space || !startISO || !endISO) return null;
    const isWeekend = [0, 6].includes(new Date(startISO).getUTCDay());
    return computeBookingPrice({
      startTime: startISO, endTime: endISO, hourlyRateCents: space.hourly_rate_cents,
      halfDayRateCents: space.half_day_rate_cents, fullDayRateCents: space.full_day_rate_cents,
      weekendHourlyRateCents: space.weekend_hourly_rate_cents, depositCents: space.deposit_amount_cents, isWeekend,
    });
  }, [space, startISO, endISO]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  if (!space || !facility) {
    return <div className="container-x py-16"><EmptyState title="Space not found" action={<Button asLink="/renter">Back to search</Button>} /></div>;
  }

  const minutes = startISO && endISO ? durationMinutes(startISO, endISO) : 0;
  const validStep0 = form.date && minutes > 0;
  const validStep1 = form.event_name.trim().length > 0;

  async function submit() {
    if (!form.agree) { toast.error('Please accept the use agreement to continue'); return; }
    setBusy(true);
    try {
      const booking = await createBooking({
        facility_id: facility!.id, space_id: space!.id, event_name: form.event_name,
        event_type: form.event_type, event_description: form.event_description,
        expected_attendance: form.expected_attendance ? Number(form.expected_attendance) : undefined,
        start_time: startISO, end_time: endISO, renter_notes: form.renter_notes,
      }, user!.id);
      toast.success('Request submitted!');
      navigate(`/renter/bookings/${booking.id}`);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  const steps = ['When', 'Your event', 'Review & request'];

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-black/5 bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/renter" className="inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Cancel</Link>
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-semibold', i <= step ? 'bg-primary text-white' : 'bg-black/5 text-stone-warm')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                <span className={cn('hidden text-sm sm:block', i === step ? 'font-semibold' : 'text-stone-warm')}>{s}</span>
                {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-black/10" />}
              </div>
            ))}
          </div>
          <span className="w-16" />
        </div>
      </div>

      <div className="container-x grid max-w-5xl gap-6 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card><CardBody className="space-y-4">
            {step === 0 && (
              <>
                <h2 className="font-display text-xl font-bold">When would you like the space?</h2>
                <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Start time" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  <Input label="End time" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </div>
                {minutes > 0 && <p className="text-sm text-stone-warm">{Math.floor(minutes / 60)}h {minutes % 60 ? `${minutes % 60}m` : ''} · turnaround buffer {space.buffer_minutes}m</p>}
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="font-display text-xl font-bold">Tell us about your event</h2>
                <Input label="Event name" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} placeholder="Spring Benefit Dinner" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Event type" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} placeholder="community" />
                  <Input label="Expected attendance" type="number" value={form.expected_attendance} onChange={(e) => setForm({ ...form, expected_attendance: e.target.value })} placeholder="80" />
                </div>
                <Textarea label="Description (optional)" value={form.event_description} onChange={(e) => setForm({ ...form, event_description: e.target.value })} />
                <Textarea label="Anything the host should know? (optional)" value={form.renter_notes} onChange={(e) => setForm({ ...form, renter_notes: e.target.value })} />
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="font-display text-xl font-bold">Review your request</h2>
                <dl className="space-y-2 text-sm">
                  <Line label="Space" value={space.name} />
                  <Line label="Event" value={form.event_name} />
                  <Line label="When" value={`${form.date} · ${form.start}–${form.end}`} />
                  <Line label="Attendance" value={form.expected_attendance || '—'} />
                </dl>
                <div className="rounded-card border border-black/10 bg-cream p-4">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} className="mt-0.5 h-4 w-4" />
                    <span>I agree to {facility.name}'s facility use agreement and will provide a certificate of insurance if required. <span className="text-stone-warm">(Digital signature — {new Date().toLocaleDateString()})</span></span>
                  </label>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-stone-warm"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary/60" /> Your card is only charged once the host approves. Submitting sends a request, not a payment.</p>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => step === 0 ? navigate('/renter') : setStep(step - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>
              {step < 2 ? (
                <Button disabled={step === 0 ? !validStep0 : !validStep1} onClick={() => setStep(step + 1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button loading={busy} onClick={submit}>Submit request</Button>
              )}
            </div>
          </CardBody></Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <SmartImage src={space.images?.[0]} alt={space.name} emoji={SPACE_TYPE_EMOJI[space.space_type]} seed={space.id} className="h-32 w-full" />
            <CardBody>
              <Badge tone="gold">{SPACE_TYPE_LABELS[space.space_type]}</Badge>
              <h3 className="mt-2 font-semibold">{space.name}</h3>
              <p className="text-xs text-stone-warm">{facility.name}</p>
              <p className="mt-2 flex items-center gap-1 text-sm text-stone-warm"><Users2 className="h-4 w-4" /> up to {space.capacity_persons ?? '—'}</p>
            </CardBody>
          </Card>
          {price && (
            <Card><CardBody className="space-y-2">
              <h3 className="font-semibold">Estimated price</h3>
              <Row label="Space" value={formatCents(price.spaceSubtotalCents)} />
              {space.deposit_amount_cents > 0 && <Row label="Deposit (refundable)" value={formatCents(space.deposit_amount_cents)} />}
              <div className="border-t border-black/5 pt-2"><Row label="Total" value={formatCents(price.subtotalCents)} bold /></div>
              <Row label="Platform fee (1.5%)" value={formatCents(price.platformFeeCents)} muted />
              <p className="pt-1 text-xs text-stone-warm">Final total is confirmed by the host. Shown transparently, never hidden.</p>
            </CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-stone-warm">{label}</dt><dd className="font-medium">{value}</dd></div>;
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return <div className={cn('flex justify-between text-sm', muted && 'text-stone-warm')}><span className={bold ? 'font-semibold' : ''}>{label}</span><span className={cn('tabular', bold && 'font-bold')}>{value}</span></div>;
}
