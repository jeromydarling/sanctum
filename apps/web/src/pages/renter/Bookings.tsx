import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Badge, Button, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { bookingsForRenter, spaceName, facilityName } from '../../lib/selectors.js';
import { formatCents, BOOKING_STATUS_META, formatRange, relativeDate } from '../../lib/format.js';

export default function Bookings() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const bookings = bookingsForRenter(data, user!.id);

  return (
    <div>
      <PageHeader title="My bookings" subtitle="Your requests, upcoming events, and past gatherings." action={<Button asLink="/renter">Find a space</Button>} />
      {bookings.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="h-8 w-8" />} title="No bookings yet" body="Find a welcoming space and send your first request." action={<Button asLink="/renter">Browse spaces</Button>} />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <Link key={b.id} to={`/renter/bookings/${b.id}`}>
                <Card className="p-4 transition hover:shadow-lift sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{b.event_name}</p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-stone-warm">{spaceName(data, b.space_id)} · {facilityName(data, b.facility_id)}</p>
                      <p className="mt-0.5 text-xs text-stone-warm">{formatRange(b.start_time, b.end_time)} · {relativeDate(b.start_time)}</p>
                    </div>
                    <span className="tabular font-semibold text-primary-700">{formatCents(b.subtotal_cents)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
