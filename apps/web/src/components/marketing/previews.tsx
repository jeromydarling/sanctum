/** Compact, live React mini-previews shown inside WindowFrames on the features page. */
import {
  Check, X, Star, Sparkles, Bell, Phone, ShieldCheck, CreditCard, Download,
  CalendarClock, Wallet, Gift, Building2, MapPin, Users2,
} from 'lucide-react';
import { UsMap } from '../UsMap.js';

const box = 'p-4 h-64 overflow-hidden text-[11px] leading-tight';
const pill = 'rounded-full px-2 py-0.5 text-[10px] font-semibold';

function H({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-display text-sm font-bold text-ink">{children}</p>;
}
function Tile({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-black/5 bg-white p-2.5 shadow-sm ${className}`}>{children}</div>;
}

export function PreviewCalendar() {
  const colors = ['bg-primary-100 text-primary-800', 'bg-gold/20 text-gold-dark', 'bg-success/15 text-success'];
  const events: Record<number, { t: string; c: number; r?: boolean }[]> = {
    3: [{ t: 'Quilting', c: 1 }], 8: [{ t: 'Daycare', c: 0, r: true }], 9: [{ t: 'Daycare', c: 0, r: true }],
    12: [{ t: 'Benefit', c: 2 }], 15: [{ t: 'Daycare', c: 0, r: true }], 20: [{ t: 'Recital', c: 1 }], 21: [{ t: 'Wedding', c: 2 }],
  };
  return (
    <div className={box}>
      <H>June</H>
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center font-semibold text-stone-warm">{d}</div>)}
        {Array.from({ length: 30 }).map((_, i) => {
          const day = i + 1;
          const evs = events[day] || [];
          return (
            <div key={i} className="min-h-7 rounded bg-white p-0.5 ring-1 ring-black/5">
              <div className="text-[9px] text-stone-warm">{day}</div>
              {evs.map((e, j) => (
                <div key={j} className={`mt-0.5 truncate rounded px-1 text-[8px] font-medium ${colors[e.c]} ${e.r ? 'border border-dashed border-primary/40' : ''}`}>{e.r ? '↻ ' : ''}{e.t}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PreviewBooking() {
  return (
    <div className={box}>
      <H>Booking requests</H>
      <Tile className="mb-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Spring Benefit Dinner</span>
          <span className={`${pill} bg-warning/15 text-[#8a5a00]`}>Pending</span>
        </div>
        <p className="mt-1 text-stone-warm">Northside Youth Theater · Fellowship Hall</p>
        <p className="text-stone-warm">Jun 13 · 5:00–10:00 PM · 160 guests</p>
        <div className="mt-2 flex gap-1.5">
          <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-semibold text-white"><Check className="h-3 w-3" /> Approve</span>
          <span className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 font-semibold"><X className="h-3 w-3" /> Decline</span>
        </div>
      </Tile>
      <Tile>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Beginner Quilting Workshop</span>
          <span className={`${pill} bg-success/15 text-success`}>Approved</span>
        </div>
        <p className="mt-1 text-stone-warm">Riverside Quilters · Classroom 1 · Jun 9</p>
      </Tile>
    </div>
  );
}

export function PreviewTenantCRM() {
  return (
    <div className={box}>
      <H>Little Lambs Daycare</H>
      <div className="grid grid-cols-3 gap-1.5">
        <Tile><p className="text-stone-warm">Each month</p><p className="font-bold text-success">$1,200</p></Tile>
        <Tile><p className="text-stone-warm">Over a year</p><p className="font-bold text-primary-700">$14,400</p></Tile>
        <Tile><p className="text-stone-warm">Reminders</p><p className="font-bold text-gold-dark">1</p></Tile>
      </div>
      <p className="mt-2 mb-1 font-semibold text-stone-warm">Your history together</p>
      <div className="space-y-1.5">
        {[{ i: Phone, k: 'Call', t: 'Asked about adding Fridays in the fall.' }, { i: Bell, k: 'Reminder', t: 'Check in about renewal.' }].map((x, j) => (
          <div key={j} className="flex gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-50 text-primary"><x.i className="h-3 w-3" /></span>
            <p className="text-stone-warm"><span className="font-semibold text-ink">{x.k}</span> — {x.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewPricing() {
  return (
    <div className={box}>
      <H>Transparent pricing</H>
      <Tile>
        <Row l="Fellowship Hall · 5 hrs" v="$600.00" />
        <Row l="Community discount (25%)" v="−$150.00" muted />
        <Row l="Round tables ×20" v="$50.00" />
        <div className="my-1 border-t border-black/5" />
        <Row l="Total" v="$500.00" bold />
        <Row l="Platform fee (1.5%)" v="$7.50" muted />
      </Tile>
      <p className="mt-2 flex items-center gap-1 text-stone-warm"><Gift className="h-3 w-3 text-primary" /> Nonprofits & schools discounted automatically.</p>
    </div>
  );
}

export function PreviewDeposit() {
  return (
    <div className={box}>
      <H>Security deposit</H>
      <Tile className="mb-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold"><Wallet className="h-3 w-3 text-primary" /> $200.00 held</span>
          <span className={`${pill} bg-gold/15 text-gold-dark`}>Held</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-md bg-primary px-2 py-1 font-semibold text-white">Return in full</span>
          <span className="rounded-md border border-black/10 px-2 py-1 font-semibold">Withhold…</span>
        </div>
      </Tile>
      <p className="text-stone-warm">Collected with payment, returned or withheld after — a real Stripe refund, with a note to the renter.</p>
    </div>
  );
}

export function PreviewAssistant() {
  return (
    <div className={box}>
      <H><span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI assistant</span></H>
      <div className="mb-2 flex flex-wrap gap-1">
        {['Pricing advisor', 'Policy builder', 'Use agreement', 'Email drafter'].map((t) => (
          <span key={t} className={`${pill} bg-primary-50 text-primary-700`}>{t}</span>
        ))}
      </div>
      <Tile>
        <p className="font-semibold">Suggested rates · Minneapolis</p>
        <p className="mt-1 text-stone-warm">Fellowship hall, cap 200: <span className="font-semibold text-ink">$100–$150/hr</span>, half-day ~$450, full day ~$800. Nonprofits often 20–30% off.</p>
        <p className="mt-1 text-[9px] text-stone-warm">✨ Verify before relying — not legal or financial advice.</p>
      </Tile>
    </div>
  );
}

export function PreviewNetwork() {
  return (
    <div className="h-64 overflow-hidden text-[11px]">
      <div className="bg-gradient-to-br from-[#3b5bdb] to-[#3b5bdbcc] p-4 text-center text-white">
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Building2 className="h-5 w-5" /></span>
        <p className="mt-2 font-display text-base font-bold">Twin Cities Faith Network</p>
        <div className="mt-1 flex justify-center gap-1.5"><span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">3 communities</span><span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">11 spaces</span></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {['St. Brigid Center', 'Grace Commons', 'Riverside Hall', 'Hope Chapel'].map((n) => (
          <div key={n} className="rounded-lg border border-black/5 bg-white p-2"><p className="font-semibold">{n}</p><p className="flex items-center gap-1 text-stone-warm"><MapPin className="h-2.5 w-2.5" /> Minneapolis, MN</p></div>
        ))}
      </div>
    </div>
  );
}

export function PreviewFinancials() {
  return (
    <div className={box}>
      <H>Financials · 2026</H>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <Tile><p className="text-stone-warm">Gross</p><p className="font-bold text-primary-700">$24,180</p></Tile>
        <Tile><p className="text-stone-warm">Fees</p><p className="font-bold text-gold-dark">$363</p></Tile>
        <Tile><p className="text-stone-warm">Net</p><p className="font-bold text-success">$23,817</p></Tile>
      </div>
      <div className="flex gap-1.5">
        <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-semibold text-white"><Download className="h-3 w-3" /> QuickBooks CSV</span>
        <span className="rounded-md border border-black/10 px-2 py-1 font-semibold">Year-end statement</span>
      </div>
      <p className="mt-2 text-stone-warm">Or sync straight to QuickBooks Online as sales receipts.</p>
    </div>
  );
}

export function PreviewMicrosite() {
  return (
    <div className="h-64 overflow-hidden text-[11px]">
      <div className="grid h-28 place-items-end bg-gradient-to-br from-primary-600 to-primary-900 p-3 text-white">
        <div>
          <p className="font-display text-base font-bold">Youth Spring Recital</p>
          <p className="flex items-center gap-1 text-white/85"><CalendarClock className="h-3 w-3" /> Jun 21 · 6:00 PM · The Chapel</p>
        </div>
      </div>
      <div className="p-3">
        <p className="text-stone-warm">An evening of music as our young performers share the songs they've worked on all season. Light refreshments to follow.</p>
        <span className="mt-2 inline-block rounded-md bg-primary px-3 py-1 font-semibold text-white">RSVP</span>
        <p className="mt-2 flex items-center gap-1 text-[9px] text-stone-warm"><Sparkles className="h-3 w-3 text-primary" /> Built with the AI website builder + command bar.</p>
      </div>
    </div>
  );
}

export function PreviewCompliance() {
  return (
    <div className={box}>
      <H><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Compliance</span></H>
      {[{ n: 'Community Mutual', s: 'Approved', t: 'success' }, { n: 'Northside Insurance', s: 'Pending', t: 'warning' }].map((d) => (
        <Tile key={d.n} className="mb-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{d.n}</span>
            <span className={`${pill} ${d.t === 'success' ? 'bg-success/15 text-success' : 'bg-warning/15 text-[#8a5a00]'}`}>{d.s}</span>
          </div>
          <p className="text-stone-warm">Certificate of insurance · $1M coverage</p>
        </Tile>
      ))}
      <p className="text-stone-warm">E-signed agreements, COI tracking, and expiry reminders — handled.</p>
    </div>
  );
}

export function PreviewDiscovery() {
  const spaces = [{ e: '🍽️', n: 'Fellowship Hall', p: '$120/hr' }, { e: '🕯️', n: 'The Chapel', p: 'Donation' }, { e: '🏀', n: 'Community Gym', p: '$100/hr' }, { e: '📚', n: 'Classroom 1', p: '$40/hr' }];
  return (
    <div className={box}>
      <H>Find a space near you</H>
      <div className="grid grid-cols-2 gap-1.5">
        {spaces.map((s) => (
          <div key={s.n} className="overflow-hidden rounded-lg border border-black/5 bg-white">
            <div className="grid h-12 place-items-center bg-gradient-to-br from-primary-400 to-primary-700 text-xl">{s.e}</div>
            <div className="p-1.5">
              <p className="font-semibold">{s.n}</p>
              <div className="flex items-center justify-between"><span className="flex items-center gap-0.5 text-stone-warm"><Users2 className="h-2.5 w-2.5" /> 80</span><span className="font-semibold text-primary-700">{s.p}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewMap() {
  return (
    <div className="h-64 overflow-hidden p-2">
      <UsMap pins={[
        { id: '1', state: 'MN', label: 'St. Brigid · Minneapolis', count: 5 },
        { id: '2', state: 'WI', label: 'Grace Commons · Madison', count: 3 },
        { id: '3', state: 'IL', label: 'Hope Chapel · Chicago', count: 2 },
        { id: '4', state: 'TX', label: 'Trinity Hall · Austin', count: 4 },
      ]} />
    </div>
  );
}

export function PreviewReviews() {
  return (
    <div className={box}>
      <H>What renters say</H>
      {[{ h: 'A dream kitchen', b: 'Everything we needed to cook for 300 neighbors.' }, { h: 'Perfect acoustics', b: 'Our recital sounded incredible in the chapel.' }].map((r) => (
        <Tile key={r.h} className="mb-1.5">
          <div className="flex gap-0.5 text-gold">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</div>
          <p className="mt-1 font-semibold">{r.h}</p>
          <p className="text-stone-warm">{r.b}</p>
        </Tile>
      ))}
    </div>
  );
}

export function PreviewPayouts() {
  return (
    <div className={box}>
      <H><span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5 text-primary" /> Instant payouts</span></H>
      <Tile className="mb-2">
        <div className="flex items-center justify-between"><span className="font-semibold">Stripe Connect</span><span className={`${pill} bg-success/15 text-success`}>Connected</span></div>
        <p className="mt-1 text-stone-warm">Funds land in your account automatically — minus a transparent 1.5%.</p>
      </Tile>
      <div className="flex items-center justify-between"><span className="text-stone-warm">Plans</span></div>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[{ n: 'Starter', p: '$9' }, { n: 'Growth', p: '$19' }, { n: 'Pro', p: '$29' }].map((pl, i) => (
          <Tile key={pl.n} className={i === 1 ? 'ring-1 ring-primary' : ''}><p className="font-semibold">{pl.n}</p><p className="font-bold">{pl.p}<span className="text-stone-warm">/mo</span></p></Tile>
        ))}
      </div>
    </div>
  );
}

function Row({ l, v, bold, muted }: { l: string; v: string; bold?: boolean; muted?: boolean }) {
  return <div className={`flex items-center justify-between ${muted ? 'text-stone-warm' : ''}`}><span className={bold ? 'font-bold' : ''}>{l}</span><span className={`tabular ${bold ? 'font-bold' : ''}`}>{v}</span></div>;
}
