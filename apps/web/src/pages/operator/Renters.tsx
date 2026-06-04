import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Badge, EmptyState } from '../../components/ui.js';
import { Users } from 'lucide-react';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { openReminders } from '../../components/CrmTimeline.js';
import { formatCents, initials } from '../../lib/format.js';
import { ORG_TYPE_LABELS } from '@sanctum/shared';

export default function Renters() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;

  const bookings = data.bookings.filter((b) => b.facility_id === facility.id);
  const renterIds = [...new Set(bookings.map((b) => b.renter_id))];
  const renters = renterIds.map((id) => {
    const p = data.profiles.find((x) => x.id === id);
    const theirs = bookings.filter((b) => b.renter_id === id);
    const spend = theirs.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
    return { id, profile: p, count: theirs.length, spend, reminders: openReminders(data, 'renter', id) };
  });

  return (
    <div>
      <PageHeader title="Renters" subtitle="The groups and neighbors who've gathered in your spaces — and the story of each relationship." />
      {renters.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No renters yet" body="When a group books your space, you'll find them here — with room to keep notes and remember the little things." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {renters.map((r) => (
            <Link key={r.id} to={`/operator/renters/${r.id}`}>
              <Card className="h-full transition hover:shadow-lift"><CardBody>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-sm font-semibold text-white">{initials(r.profile?.full_name || r.profile?.organization_name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.profile?.full_name || r.profile?.organization_name || 'Guest'}</p>
                    <p className="truncate text-xs text-stone-warm">{r.profile?.email}</p>
                  </div>
                </div>
                {r.profile?.organization_name && r.profile?.full_name && <p className="mt-3 text-sm text-stone-warm">{r.profile.organization_name}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{r.count} gathering{r.count !== 1 ? 's' : ''}</Badge>
                  {r.profile?.organization_type && <Badge tone="primary">{ORG_TYPE_LABELS[r.profile.organization_type]}</Badge>}
                  {r.reminders > 0 && <Badge tone="gold">{r.reminders} reminder{r.reminders !== 1 ? 's' : ''}</Badge>}
                  <span className="tabular ml-auto text-sm font-semibold text-success">{formatCents(r.spend)}</span>
                </div>
              </CardBody></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
