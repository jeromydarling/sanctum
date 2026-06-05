/** A gentle guided tour for demo visitors — walks through each area, navigating
 *  as it goes. Shows once per demo session; never in live accounts. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Compass } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { isDemo } from '../../lib/config.js';
import { cn } from '../../lib/cn.js';
import type { Role } from '@sanctum/shared';

interface Step { path: string; title: string; body: string; }

const TOURS: Record<'operator' | 'renter' | 'admin', Step[]> = {
  operator: [
    { path: '/operator', title: 'Welcome — this is your dashboard', body: "The heartbeat of your community: revenue, requests waiting, and what's coming up this week." },
    { path: '/operator/calendar', title: 'One calendar for everything', body: 'Bookings, recurring tenants, and blocked times together. You can sync your own Google or Outlook calendar so a rental never clashes with your services.' },
    { path: '/operator/bookings', title: 'Requests, handled in a tap', body: 'Approve or decline here — or let renters book and pay straight through. Double-booking is impossible.' },
    { path: '/operator/tenants', title: 'Tenants & a human CRM', body: 'Your weekly groups, billed automatically — with a warm record of every call, note, and reminder. Open one to see the relationship.' },
    { path: '/operator/compliance', title: 'Protected by default', body: 'E-signed agreements and certificates of insurance, tracked for you with expiry reminders.' },
    { path: '/operator/financials', title: 'Books your treasurer will love', body: 'Gross, fees, and net at a glance; a year-end statement; and a QuickBooks export or live sync.' },
    { path: '/operator/assistant', title: 'AI does the paperwork', body: 'Draft agreements, pricing guidance, descriptions, and warm replies — always verify-first.' },
    { path: '/operator', title: "That's the tour", body: 'Explore freely — wander into any corner. Nothing here is ever saved.' },
  ],
  renter: [
    { path: '/renter', title: 'Find a welcoming space', body: 'Discover community spaces by city and type — including donation-based and free-for-ministry rooms.' },
    { path: '/renter/bookings', title: 'Your gatherings', body: 'Requests, confirmed events, and receipts all live here.' },
    { path: '/renter/sites', title: 'Build an event page with AI', body: 'Spin up a beautiful public page for your event — an AI website builder with a natural-language command bar.' },
    { path: '/renter/learn', title: 'Guidance when you need it', body: 'Plain-language help on insurance, permits, and agreements — with an AI you can ask anything.' },
    { path: '/renter', title: "That's the tour", body: 'Explore freely — nothing here is saved.' },
  ],
  admin: [
    { path: '/admin', title: 'The whole platform', body: 'Communities, value booked, and revenue across the network at a glance.' },
    { path: '/admin/facilities', title: 'Every community', body: 'Browse all the communities on the platform.' },
    { path: '/admin/networks', title: 'White-label networks', body: 'Dioceses, associations, and conferences — one branded home for many communities.' },
    { path: '/admin', title: "That's the tour", body: 'Explore freely — nothing here is saved.' },
  ],
};

const DONE_KEY = 'sanctum.tourDone';

export function DemoTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);

  const role = (user?.role || 'operator') as Role;
  const tourRole: 'operator' | 'renter' | 'admin' = role === 'staff' ? 'operator' : (role as 'operator' | 'renter' | 'admin');
  const steps = TOURS[tourRole] || TOURS.operator;

  useEffect(() => {
    if (isDemo() && user && sessionStorage.getItem(DONE_KEY) !== '1') {
      const t = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  if (!active) return null;
  const step = steps[i];

  function go(n: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, n));
    setI(clamped);
    navigate(steps[clamped].path);
  }
  function finish() {
    sessionStorage.setItem(DONE_KEY, '1');
    setActive(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,22rem)] animate-fade-up">
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lift">
        <div className="flex items-center justify-between bg-primary px-4 py-2.5 text-white">
          <span className="flex items-center gap-2 text-sm font-semibold"><Compass className="h-4 w-4" /> Guided tour</span>
          <button onClick={finish} className="rounded p-1 hover:bg-white/15" aria-label="Skip tour"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-bold">{step.title}</h3>
          <p className="mt-1.5 text-sm text-stone-warm">{step.body}</p>
          <div className="mt-3 flex items-center gap-1">
            {steps.map((_, j) => <span key={j} className={cn('h-1.5 rounded-full transition-all', j === i ? 'w-5 bg-primary' : 'w-1.5 bg-black/10')} />)}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button onClick={finish} className="text-xs font-medium text-stone-warm hover:text-ink">Skip</button>
            <div className="flex gap-2">
              {i > 0 && (
                <button onClick={() => go(i - 1)} className="btn border border-black/15 px-3 py-1.5 text-sm font-semibold hover:bg-black/5"><ArrowLeft className="h-3.5 w-3.5" /></button>
              )}
              {i < steps.length - 1 ? (
                <button onClick={() => go(i + 1)} className="btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">Next <ArrowRight className="h-3.5 w-3.5" /></button>
              ) : (
                <button onClick={finish} className="btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">Explore freely</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
