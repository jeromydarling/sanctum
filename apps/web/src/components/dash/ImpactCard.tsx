import { HeartHandshake, Users2, Clock, DoorOpen, Gift } from 'lucide-react';
import { computeImpact, startOfMonthISO, formatCents, type Facility } from '@sanctum/shared';
import { useStore } from '../../lib/store.js';
import { bookingsForFacility } from '../../lib/selectors.js';

/**
 * "Your impact" — the good this community is doing, at a glance. A retention
 * surface: the most honest reason to stay is seeing the doors you've opened.
 */
export function ImpactCard({ facility }: { facility: Facility }) {
  const data = useStore((d) => d);
  const bookings = bookingsForFacility(data, facility.id);
  const month = computeImpact(bookings, startOfMonthISO(new Date()));
  const all = computeImpact(bookings);
  if (all.eventsHosted === 0) return null; // nothing to celebrate yet — don't nag

  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const items = [
    { icon: DoorOpen, label: 'Events hosted', month: month.eventsHosted, all: all.eventsHosted },
    { icon: Users2, label: 'Neighbors welcomed', month: month.neighborsWelcomed, all: all.neighborsWelcomed },
    { icon: Clock, label: 'Hours your doors were open', month: month.hoursOpen, all: all.hoursOpen },
    { icon: Gift, label: 'Hours given freely', month: month.givenHours, all: all.givenHours },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-card border border-primary/15 bg-gradient-to-br from-primary-50/70 to-gold/5">
      <div className="flex flex-col gap-1 border-b border-primary/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-gold-light"><HeartHandshake className="h-5 w-5" /></span>
          <div>
            <h2 className="font-display text-lg font-bold">Your impact</h2>
            <p className="text-xs text-stone-warm">Open doors. Stronger communities.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="tabular text-2xl font-bold text-primary-700">{formatCents(all.earnedCents)}</p>
          <p className="text-xs text-stone-warm">earned for your community · all time</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-primary/5 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="bg-cream/40 px-5 py-4">
            <it.icon className="h-4 w-4 text-primary" />
            <p className="tabular mt-2 text-2xl font-bold leading-none">{it.month}</p>
            <p className="mt-1 text-xs font-medium text-ink/70">{it.label}</p>
            <p className="mt-0.5 text-[11px] text-stone-warm">in {monthName} · {it.all} all time</p>
          </div>
        ))}
      </div>
    </div>
  );
}
