import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Building2, User, ShieldCheck, Network } from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { WindowFrame } from '../../components/marketing/WindowFrame.js';
import { Reveal } from '../../components/Reveal.js';
import { Button, Badge } from '../../components/ui.js';
import { useAuth } from '../../lib/auth.js';
import { cn } from '../../lib/cn.js';
import type { Role } from '@sanctum/shared';
import * as P from '../../components/marketing/previews.js';

interface Showcase {
  url: string;
  Preview: () => JSX.Element;
  title: string;
  desc: string;
  demo?: { role: Role; path: string; label: string };
}

const SHOWCASE: { section: string; items: Showcase[] }[] = [
  {
    section: 'Running your spaces',
    items: [
      { url: 'sanctum.garden/operator/calendar', Preview: P.PreviewCalendar, title: 'One calendar for everything', desc: 'Bookings, recurring tenants, and the times you block off — color-coded, in one place. Import your own Google/Outlook calendar so a rental can never collide with your services.', demo: { role: 'operator', path: '/operator/calendar', label: 'Open the calendar' } },
      { url: 'sanctum.garden/operator/bookings', Preview: P.PreviewBooking, title: 'Requests, handled in a tap', desc: 'Approve or decline with one click — or skip approvals entirely so renters book and pay straight through. Double-booking is impossible, guaranteed server-side.', demo: { role: 'operator', path: '/operator/bookings', label: 'Review bookings' } },
      { url: 'sanctum.garden/operator/tenants', Preview: P.PreviewTenantCRM, title: 'Recurring tenants & a human CRM', desc: 'The daycare, the AA group, the congregation that meets weekly — held on your calendar, invoiced automatically, with a warm relationship log of every note, call, and reminder.', demo: { role: 'operator', path: '/operator/tenants', label: 'Meet the tenants' } },
      { url: 'sanctum.garden/operator/compliance', Preview: P.PreviewCompliance, title: 'Protected by default', desc: 'E-signed use agreements with an audit trail, certificate-of-insurance tracking, and an AI gate that screens each request against your rules. Peace of mind built in.', demo: { role: 'operator', path: '/operator/compliance', label: 'See compliance' } },
    ],
  },
  {
    section: 'Pricing, payments & books',
    items: [
      { url: 'sanctum.garden/book', Preview: P.PreviewPricing, title: 'Transparent, fair pricing', desc: 'A clear breakdown every time — never hidden. Automatic discounts for nonprofits and schools, weekend rates, deposits, and a transparent 1.5% shown as a line item.' },
      { url: 'sanctum.garden/operator/settings', Preview: P.PreviewPayouts, title: 'Get paid automatically', desc: 'Stripe Connect routes funds straight to you. Plans from $9/mo, a 30-day free trial, and billing you can manage yourself — cancel anytime.', demo: { role: 'operator', path: '/operator/settings', label: 'Open settings' } },
      { url: 'sanctum.garden/operator/bookings/bkg-3', Preview: P.PreviewDeposit, title: 'Security deposits, done right', desc: 'Collected with payment, then returned in full or partly withheld for damages — a real refund, with a kind note to the renter. Cash deposits tracked too.' },
      { url: 'sanctum.garden/operator/financials', Preview: P.PreviewFinancials, title: 'Books your treasurer will love', desc: 'Gross, fees, and net at a glance; a printable year-end statement; a QuickBooks-ready CSV; and a live QuickBooks Online sync when you want it.', demo: { role: 'operator', path: '/operator/financials', label: 'Open financials' } },
    ],
  },
  {
    section: 'Reaching the community',
    items: [
      { url: 'sanctum.garden/find', Preview: P.PreviewDiscovery, title: 'A welcoming public listing', desc: 'A polished page for your community and a discovery network where renters find you by city, space, and date — including donation-based and free-for-ministry spaces.', demo: { role: 'renter', path: '/renter', label: 'Browse as a renter' } },
      { url: 'sanctum.garden/find', Preview: P.PreviewMap, title: 'Find a space on the map', desc: 'A clean map view of every listed community — built in-house, no third-party maps. The more communities that open their doors, the stronger the network.' },
      { url: 'sanctum.garden/e/youth-spring-recital', Preview: P.PreviewMicrosite, title: 'Event pages, built by AI', desc: 'Every renter can spin up a beautiful public event page — an AI website builder and a natural-language command bar with undo, RSVP, and a shareable link.' },
      { url: 'sanctum.garden/operator/assistant', Preview: P.PreviewAssistant, title: 'AI that does the paperwork', desc: 'Draft agreements, pricing guidance, space descriptions, policies, and warm replies — all with a verify-first note. Powered entirely by Cloudflare Workers AI.', demo: { role: 'operator', path: '/operator/assistant', label: 'Try the assistant' } },
    ],
  },
  {
    section: 'For networks & the whole platform',
    items: [
      { url: 'sanctum.garden/n/twin-cities-faith-network', Preview: P.PreviewNetwork, title: 'White-label for networks', desc: 'A diocese, association, or conference gets a branded page across all its communities, self-serve invitations, and rolled-up reporting — one relationship, hundreds of doors.', demo: { role: 'admin', path: '/admin', label: 'Peek at admin' } },
      { url: 'sanctum.garden/c/st-brigid-community-center', Preview: P.PreviewReviews, title: 'Reviews & reputation', desc: 'Renters leave reviews after their events; you reply, and the best ones grace your public page — trust that compounds.' },
    ],
  },
];

const CHECKLIST: { group: string; icon: typeof Building2; items: string[] }[] = [
  { group: 'Operators', icon: Building2, items: ['Guided AI onboarding & website import', 'Spaces & resources with Image Studio', 'Calendar + Google/Outlook two-way sync', 'Date-blocking & manual walk-in bookings', 'Approvals (or instant book) + double-booking lock', 'Recurring tenants & long-term leases', 'Human tenant & renter CRM with reminders', 'Inquiries pipeline', 'Compliance: e-sign + COI tracking', 'Pricing rules, donation & free modes', 'Security/damage deposits', 'Invoices & auto-monthly billing', 'Analytics & financials + QuickBooks', 'AI assistant & event screening'] },
  { group: 'Renters', icon: User, items: ['Discover spaces by city & type', 'Multi-step booking with live pricing', 'Pay-what-you-can donations', 'E-sign the use agreement', 'Upload certificates of insurance', 'My bookings, documents & receipts', 'AI event-page builder + RSVP', 'Learning hub with AI guidance', 'Reviews after events', 'Export or delete my data'] },
  { group: 'Networks & Admin', icon: Network, items: ['White-label network pages', 'Self-serve parish invitations', 'Network rollup reporting', 'Platform overview (GMV, MRR)', 'Facilities & users', 'Announcements to all operators', 'Error & incident log'] },
  { group: 'Under the hood', icon: ShieldCheck, items: ['100% Cloudflare (D1, R2, Images, Workers AI, Email)', 'Stripe Connect payments & subscriptions', 'Cloudflare Email Service (no third party)', 'Turnstile bot protection', 'JWT + PBKDF2 auth, per-row authorization', 'Server-side money, signed webhooks', 'Reminders & COI-expiry cron', 'GDPR export & delete'] },
];

export default function Features() {
  const navigate = useNavigate();
  const { demoLogin, user } = useAuth();

  function tour(role: Role, path: string) {
    if (user) { navigate(path); return; }
    demoLogin(role === 'staff' ? 'operator' : (role as 'operator' | 'renter' | 'admin'));
    navigate(path);
  }

  return (
    <MarketingShell>
      <MarketingNav />

      <section className="relative overflow-hidden">
        <div className="mesh-gradient absolute inset-0 -z-10" />
        <div className="container-x py-16 text-center sm:py-20">
          <Reveal>
            <Badge tone="gold" className="mb-4">Every feature, working — not a mockup</Badge>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">See it all. Then go touch every corner yourself.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink/70">A full, working product — calendar, payments, tenants, compliance, AI, networks, and more. Jump straight into a live demo with seeded data; nothing is saved.</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => tour('operator', '/operator')}><Building2 className="h-4 w-4" /> Tour as an operator</Button>
              <Button size="lg" variant="outline" onClick={() => tour('renter', '/renter')}><User className="h-4 w-4" /> Tour as a renter</Button>
              <Button size="lg" variant="ghost" onClick={() => tour('admin', '/admin')}><ShieldCheck className="h-4 w-4" /> Peek at admin</Button>
            </div>
            <p className="mt-3 text-sm text-stone-warm">One click — no signup. Resets when you leave.</p>
          </Reveal>
        </div>
      </section>

      {SHOWCASE.map((sec, si) => (
        <section key={sec.section} className={cn('py-14', si % 2 === 1 && 'bg-white')}>
          <div className="container-x">
            <Reveal><h2 className="mb-10 text-center font-display text-3xl font-bold">{sec.section}</h2></Reveal>
            <div className="space-y-16">
              {sec.items.map((item, i) => (
                <Reveal key={item.title}>
                  <div className={cn('grid items-center gap-8 lg:grid-cols-2', i % 2 === 1 && 'lg:[&>*:first-child]:order-2')}>
                    <WindowFrame url={item.url}><item.Preview /></WindowFrame>
                    <div>
                      <h3 className="font-display text-2xl font-bold">{item.title}</h3>
                      <p className="mt-3 text-ink/70">{item.desc}</p>
                      {item.demo && (
                        <button onClick={() => tour(item.demo!.role, item.demo!.path)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                          {item.demo.label} <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Full checklist */}
      <section className="bg-ink py-16 text-white">
        <div className="container-x">
          <Reveal><h2 className="text-center font-display text-3xl font-bold">Everything, in one list</h2></Reveal>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {CHECKLIST.map((g) => (
              <Reveal key={g.group}>
                <div>
                  <div className="mb-3 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-card bg-white/10 text-gold-light"><g.icon className="h-5 w-5" /></span><h3 className="font-semibold">{g.group}</h3></div>
                  <ul className="space-y-1.5">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm text-white/75"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-light" /> {it}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold">Don't take our word for it — open the doors.</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink/70">Step into the full app as any role. Every screen above is one click away.</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => tour('operator', '/operator')}>Launch the demo <ArrowRight className="h-4 w-4" /></Button>
            <Button size="lg" variant="outline" asLink="/signup">Open your own doors</Button>
          </div>
        </Reveal>
      </section>
      <Footer />
    </MarketingShell>
  );
}
