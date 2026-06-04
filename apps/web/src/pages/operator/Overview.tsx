import { Link } from 'react-router-dom';
import { Inbox, ShieldCheck, Banknote, CalendarDays, ArrowRight, Plus, ExternalLink, Sparkles, Check } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat, Badge, Button, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, bookingsForFacility, spaceName, renterName } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange, relativeDate } from '../../lib/format.js';

export default function Overview() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);

  if (!facility) {
    return <EmptyState title="Let's set up your community" body="Create your facility to start listing spaces." action={<Button asLink="/operator/settings">Go to settings</Button>} />;
  }

  const bookings = bookingsForFacility(data, facility.id);
  const now = Date.now();
  const pending = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter((b) => ['approved', 'confirmed'].includes(b.status) && new Date(b.start_time).getTime() > now);
  const thisMonth = bookings.filter((b) => {
    const d = new Date(b.start_time);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && ['confirmed', 'completed'].includes(b.status);
  });
  const revenue = bookings.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
  const pendingCoi = data.compliance_docs.filter((c) => c.facility_id === facility.id && c.status === 'pending').length;

  const facilitySpaces = data.spaces.filter((s) => s.facility_id === facility.id);
  const setupItems = [
    { done: facilitySpaces.length > 0, label: 'Add your spaces', to: '/operator/spaces' },
    { done: !!facility.description, label: 'Write your community description', to: '/operator/settings' },
    { done: !!facility.use_agreement_text, label: 'Add a use agreement', to: '/operator/settings' },
    { done: facility.stripe_onboarded === 1, label: 'Connect payouts', to: '/operator/settings' },
  ];
  const remaining = setupItems.filter((i) => !i.done).length;

  return (
    <div>
      {remaining > 0 && (
        <Card className="mb-6 border-primary/15 bg-primary-50/40">
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Finish setting up — {setupItems.length - remaining}/{setupItems.length} done</h2>
                <p className="mt-0.5 text-sm text-stone-warm">A few quick steps and you're ready to welcome the community.</p>
              </div>
              <Button asLink="/onboarding"><Sparkles className="h-4 w-4" /> Guided setup</Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {setupItems.map((i) => (
                <Link key={i.label} to={i.to} className="flex items-center gap-2 rounded-card bg-white/70 px-3 py-2 text-sm hover:bg-white">
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${i.done ? 'bg-success text-white' : 'border border-black/15'}`}>{i.done && <Check className="h-3 w-3" />}</span>
                  <span className={i.done ? 'text-stone-warm line-through' : 'font-medium'}>{i.label}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'friend'}`}
        subtitle={facility.name}
        action={
          <>
            <Button variant="outline" asLink={`/c/${facility.slug}`}>View public page <ExternalLink className="h-4 w-4" /></Button>
            <Button asLink="/operator/spaces"><Plus className="h-4 w-4" /> New space</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (all time)" value={formatCents(revenue)} sub={`${thisMonth.length} confirmed this month`} tone="success" />
        <Stat label="Pending requests" value={pending.length} sub="awaiting your review" tone="gold" />
        <Stat label="Upcoming events" value={upcoming.length} sub="approved & confirmed" />
        <Stat label="Compliance to review" value={pendingCoi} sub="insurance documents" tone="primary" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <h2 className="font-semibold">Pending requests</h2>
              <Link to="/operator/bookings" className="text-sm font-medium text-primary hover:underline">All bookings →</Link>
            </div>
            {pending.length === 0 ? (
              <div className="p-5"><EmptyState icon={<Inbox className="h-8 w-8" />} title="No requests waiting" body="New booking requests will appear here for your review." /></div>
            ) : (
              <ul className="divide-y divide-black/5">
                {pending.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link to={`/operator/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-black/[0.02]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b.event_name}</p>
                        <p className="mt-0.5 text-xs text-stone-warm">{renterName(data, b.renter_id)} · {spaceName(data, b.space_id)}</p>
                        <p className="mt-0.5 text-xs text-stone-warm">{formatRange(b.start_time, b.end_time)} · {relativeDate(b.start_time)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular font-semibold text-primary-700">{formatCents(b.subtotal_cents)}</span>
                        <ArrowRight className="h-4 w-4 text-stone-warm" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card><CardBody>
            <h3 className="font-semibold">This week</h3>
            <div className="mt-3 space-y-3">
              {upcoming.slice(0, 4).map((b) => (
                <div key={b.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-card bg-primary-50 text-primary"><CalendarDays className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.event_name}</p>
                    <p className="text-xs text-stone-warm">{formatRange(b.start_time, b.end_time)}</p>
                  </div>
                  <Badge tone={BOOKING_STATUS_META[b.status].tone}>{BOOKING_STATUS_META[b.status].label}</Badge>
                </div>
              ))}
              {upcoming.length === 0 && <p className="text-sm text-stone-warm">No upcoming events yet.</p>}
            </div>
          </CardBody></Card>

          <Card><CardBody className="space-y-2">
            <h3 className="font-semibold">Quick actions</h3>
            <QuickLink to="/operator/bookings" icon={Inbox} label="Review requests" />
            <QuickLink to="/operator/compliance" icon={ShieldCheck} label="Check compliance" />
            <QuickLink to="/operator/invoices" icon={Banknote} label="Manage invoices" />
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Inbox; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-card px-2 py-1.5 text-sm font-medium text-ink/80 hover:bg-black/[0.03]">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </Link>
  );
}
