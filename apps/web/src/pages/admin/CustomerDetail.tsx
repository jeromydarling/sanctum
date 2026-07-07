import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Mail, MessageSquare, ExternalLink, MapPin, CalendarDays } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat, Badge, Button, Input, Textarea, Modal, EmptyState } from '../../components/ui.js';
import { UsMap } from '../../components/UsMap.js';
import { AdminTimeline } from '../../components/dash/AdminTimeline.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spacesForFacility, bookingsForFacility, spaceName, profile as profileSel } from '../../lib/selectors.js';
import { formatCents, formatRange, formatDate, initials, BOOKING_STATUS_META } from '../../lib/format.js';
import { api } from '../../lib/api.js';
import { isLive } from '../../lib/config.js';
import { notifyError } from '../../lib/errors.js';
import { PLAN_DETAILS, type Plan } from '@sanctum/shared';

const REALIZED = ['confirmed', 'completed'];

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const [msgOpen, setMsgOpen] = useState(false);

  const me = profileSel(data, id || '');
  if (!me) return <EmptyState title="Customer not found" action={<Button asLink="/admin/customers">Back to customers</Button>} />;

  const facility = facilityForOperator(data, me.id);
  const spaces = facility ? spacesForFacility(data, facility.id) : [];
  const bookings = facility ? bookingsForFacility(data, facility.id) : [];
  const realized = bookings.filter((b) => REALIZED.includes(b.status));
  const gmv = realized.reduce((s, b) => s + b.subtotal_cents, 0);
  const fee = realized.reduce((s, b) => s + b.platform_fee_cents, 0);
  const status = facility?.subscription_status || 'trialing';
  const plan = (facility?.plan || 'starter') as Plan;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Customers</Link>

      <PageHeader
        title={me.organization_name || me.full_name || 'Customer'}
        subtitle={facility ? `${facility.name}${facility.city ? ` · ${facility.city}, ${facility.state}` : ''}` : 'No facility yet'}
        action={
          <>
            <Button variant="outline" onClick={() => setMsgOpen(true)}><MessageSquare className="h-4 w-4" /> Message</Button>
            <Button variant="outline" asLink={`mailto:${me.email}`}><Mail className="h-4 w-4" /> Email</Button>
            {facility && <Button variant="ghost" asLink={`/c/${facility.slug}`}><ExternalLink className="h-4 w-4" /> Public page</Button>}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="GMV (all time)" value={formatCents(gmv)} sub={`${realized.length} paid bookings`} tone="success" />
        <Stat label="Platform revenue" value={formatCents(fee)} sub="1.5% booking fee" tone="primary" />
        <Stat label="Plan" value={PLAN_DETAILS[plan].name} sub={`${formatCents(PLAN_DETAILS[plan].priceCents)}/mo`} />
        <Stat label="Subscription" value={<span className="capitalize">{status}</span>} tone={['past_due', 'unpaid', 'canceled'].includes(status) ? 'danger' : status === 'active' ? 'success' : 'gold'} sub={`${spaces.length} spaces listed`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardBody>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{initials(me.full_name)}</span>
              <div>
                <p className="font-semibold">{me.full_name}</p>
                <p className="text-sm text-stone-warm">{me.email}{me.phone ? ` · ${me.phone}` : ''}</p>
                <p className="text-xs text-stone-warm">Member since {formatDate(me.created_at)}</p>
              </div>
            </div>
          </CardBody></Card>

          <AdminTimeline subjectId={me.id} userId={user!.id} />

          <Card>
            <div className="border-b border-black/5 px-5 py-4"><h2 className="font-semibold">Recent bookings</h2></div>
            {realized.length === 0 ? (
              <div className="p-5"><EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No bookings yet" body="This customer hasn't hosted a paid booking." /></div>
            ) : (
              <ul className="divide-y divide-black/5">
                {bookings.slice(0, 6).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.event_name}</p>
                      <p className="text-xs text-stone-warm">{spaceName(data, b.space_id)} · {formatRange(b.start_time, b.end_time)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular text-sm font-medium">{formatCents(b.subtotal_cents)}</span>
                      <Badge tone={BOOKING_STATUS_META[b.status].tone}>{BOOKING_STATUS_META[b.status].label}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {facility?.state && (
            <Card><CardBody>
              <h3 className="flex items-center gap-1.5 font-semibold"><MapPin className="h-4 w-4 text-primary" /> Location</h3>
              <p className="mb-2 mt-1 text-sm text-stone-warm">{facility.address ? `${facility.address}, ` : ''}{facility.city}, {facility.state}</p>
              <UsMap pins={[{ id: facility.id, state: facility.state, count: 1, label: `${facility.name} · ${facility.city}, ${facility.state}` }]} />
            </CardBody></Card>
          )}
          <Card><CardBody className="space-y-2">
            <h3 className="font-semibold">Spaces</h3>
            {spaces.length === 0 ? <p className="text-sm text-stone-warm">No spaces listed.</p> : spaces.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.name}</span>
                <span className="tabular text-stone-warm">{formatCents(s.hourly_rate_cents || 0)}/hr</span>
              </div>
            ))}
          </CardBody></Card>
        </div>
      </div>

      {msgOpen && <MessageModal userId={me.id} name={me.full_name || me.email} onClose={() => setMsgOpen(false)} />}
    </div>
  );
}

function MessageModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim()) { toast.error('Add a subject'); return; }
    setBusy(true);
    try {
      if (isLive()) await api('/admin/message', { body: { user_id: userId, title: title.trim(), body, email } });
      toast.success(`Message sent to ${name}`);
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Message ${name}`}>
      <div className="space-y-3">
        <Input label="Subject" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Checking in" />
        <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="A short, human note…" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4" /> Also send by email
        </label>
        <p className="text-xs text-stone-warm">Delivers an in-app notification{email ? ' and an email' : ''}. Kept human — no bulk blast.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={send}><MessageSquare className="h-4 w-4" /> Send</Button></div>
      </div>
    </Modal>
  );
}
