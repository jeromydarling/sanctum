import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, CalendarDays, FileText } from 'lucide-react';
import { Card, CardBody, Button, Badge, Stat, EmptyState } from '../../components/ui.js';
import { CrmTimeline, openReminders } from '../../components/CrmTimeline.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName } from '../../lib/selectors.js';
import { formatCents, formatDate, formatRange, BOOKING_STATUS_META, initials } from '../../lib/format.js';
import { ORG_TYPE_LABELS } from '@sanctum/shared';

export default function RenterDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const renter = data.profiles.find((p) => p.id === id);

  if (!facility) return <EmptyState title="No facility yet" />;

  const bookings = data.bookings
    .filter((b) => b.facility_id === facility.id && b.renter_id === id)
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
  if (!renter && bookings.length === 0) {
    return <EmptyState title="We don't have a record for this group yet" action={<Button asLink="/operator/renters">Back to renters</Button>} />;
  }

  const name = renter?.full_name || renter?.organization_name || 'Guest';
  const coiDocs = data.compliance_docs.filter((c) => c.facility_id === facility.id && c.renter_id === id);
  const spend = bookings.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
  const reminders = openReminders(data, 'renter', id!);

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/operator/renters" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Renters</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-semibold text-white">{initials(name)}</span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{name}</h1>
            <p className="mt-0.5 text-sm text-stone-warm">{renter?.organization_name && renter?.full_name ? renter.organization_name : ''}{renter?.organization_type ? ` · ${ORG_TYPE_LABELS[renter.organization_type]}` : ''}</p>
          </div>
        </div>
        {renter?.email && <Button variant="outline" size="sm" onClick={() => { window.location.href = `mailto:${renter.email}`; }}><Mail className="h-4 w-4" /> Email</Button>}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Times they've gathered" value={bookings.length} tone="primary" />
        <Stat label="Welcomed in total" value={formatCents(spend)} tone="success" />
        <Stat label="Reminders" value={reminders} tone={reminders ? 'gold' : 'neutral'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CrmTimeline facilityId={facility.id} subjectKind="renter" subjectId={id!} userId={user!.id} placeholder={`Write down a note about ${name}…`} />
        </div>

        <div className="space-y-5">
          <Card><CardBody className="space-y-2">
            <h2 className="font-semibold">Contact</h2>
            {renter?.email && <a href={`mailto:${renter.email}`} className="flex items-center gap-2 text-sm text-ink/80 hover:text-primary"><Mail className="h-4 w-4" /> {renter.email}</a>}
            {renter?.phone && <a href={`tel:${renter.phone}`} className="flex items-center gap-2 text-sm text-ink/80 hover:text-primary"><Phone className="h-4 w-4" /> {renter.phone}</a>}
            {renter?.organization_name && <p className="flex items-center gap-2 text-sm text-stone-warm"><Building2 className="h-4 w-4" /> {renter.organization_name}</p>}
            {!renter?.email && !renter?.phone && <p className="text-sm text-stone-warm">No contact details on file.</p>}
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Their gatherings</h2>
            <div className="mt-3 space-y-2">
              {bookings.length === 0 ? <p className="text-sm text-stone-warm">No bookings yet.</p> : bookings.slice(0, 6).map((b) => (
                <Link key={b.id} to={`/operator/bookings/${b.id}`} className="block rounded-card border border-black/5 px-3 py-2 hover:bg-black/[0.02]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{b.event_name}</span>
                    <Badge tone={BOOKING_STATUS_META[b.status].tone}>{BOOKING_STATUS_META[b.status].label}</Badge>
                  </div>
                  <p className="text-xs text-stone-warm">{spaceName(data, b.space_id)} · {formatRange(b.start_time, b.end_time)}</p>
                </Link>
              ))}
            </div>
          </CardBody></Card>

          {coiDocs.length > 0 && (
            <Card><CardBody>
              <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" /> Documents</h2>
              <div className="mt-3 space-y-2">
                {coiDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>Insurance{d.expiration_date ? ` · exp ${formatDate(d.expiration_date)}` : ''}</span>
                    <Badge tone={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}>{d.status}</Badge>
                  </div>
                ))}
              </div>
            </CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}
