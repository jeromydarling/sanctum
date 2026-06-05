import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarCheck, ShieldCheck, Banknote, Sparkles, DoorOpen,
  HeartHandshake, Building2, Users, TrendingUp, Check, Star, Repeat, Gift,
} from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { Reveal } from '../../components/Reveal.js';
import { Button, Card, CardBody, Badge } from '../../components/ui.js';
import { formatCents, PLAN_DETAILS } from '@sanctum/shared';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <MarketingShell>
      <MarketingNav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mesh-gradient absolute inset-0 -z-10" />
        <div className="absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-primary-300/30 blur-3xl animate-blob" />
        <div className="absolute right-0 top-40 -z-10 h-80 w-80 rounded-full bg-gold/20 blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
        <div className="container-x py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <Badge tone="gold" className="mb-5 px-3 py-1 text-[13px]">
                <DoorOpen className="h-3.5 w-3.5" /> Open doors. Stronger communities.
              </Badge>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
                A hall sitting empty six days a week is{' '}
                <span className="animate-text-gradient">a gift waiting to be given.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-ink/70">
                Sanctum is the all-in-one platform that helps community spaces open their doors —
                turning underused rooms, halls, kitchens, and gyms into sustaining income and a
                stronger neighborhood. Built so small, local communities get powerful tools without
                giving away what they earn.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate('/signup')}>
                  Open your doors <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/find')}>
                  Find a space near you
                </Button>
                <Button size="lg" variant="ghost" onClick={() => navigate('/features')}>
                  See every feature
                </Button>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="mt-6 text-sm text-stone-warm">
                A near-free monthly plan + a transparent <strong className="text-ink">1.5%</strong> on paid bookings.
                No setup fees. Try the full demo below — no signup required.
              </p>
            </Reveal>
          </div>

          {/* Floating stat band */}
          <Reveal delay={400}>
            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { v: '350k+', l: 'community buildings in the U.S.' },
                { v: '80%', l: 'of the week they sit empty' },
                { v: '1.5%', l: 'our fee — vs 20% elsewhere' },
                { v: '$9/mo', l: 'to start — not $180' },
              ].map((s) => (
                <div key={s.l} className="rounded-card border border-black/5 bg-white/70 p-4 text-center backdrop-blur">
                  <div className="tabular text-2xl font-bold text-primary-700">{s.v}</div>
                  <div className="mt-1 text-xs text-stone-warm">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOUR-PILLAR PROMISE */}
      <section className="bg-white py-20">
        <div className="container-x">
          <Reveal>
            <h2 className="mx-auto max-w-4xl text-center font-display text-3xl font-bold leading-snug sm:text-[2.6rem]">
              Sanctum <span className="text-gradient">knows your calendar</span>, protects you legally,
              handles your weekly tenants, and lets you <span className="text-gradient">give space away</span> as
              easily as you rent it.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarCheck, t: 'Knows your calendar', d: 'Sync your church\'s own Google or iCal schedule so a rental can never collide with your youth group, choir, or Sunday service.' },
              { icon: ShieldCheck, t: 'Protects you legally', d: 'E-signed use agreements, certificate-of-insurance tracking, security deposits, and an AI gate that screens every request against your rules.' },
              { icon: Repeat, t: 'Handles weekly tenants', d: 'Recurring bookings and long-term tenant leases — the daycare, the AA group, the congregation that meets every week — billed automatically.' },
              { icon: Gift, t: 'Give as easily as you rent', d: 'Offer space free to ministries, collect a suggested donation, or waive fees by group. Generosity, built in — not bolted on.' },
            ].map((p, i) => (
              <Reveal key={p.t} delay={i * 90}>
                <Card className="h-full transition hover:shadow-lift">
                  <CardBody>
                    <span className="grid h-12 w-12 place-items-center rounded-card bg-primary text-gold-light"><p.icon className="h-6 w-6" /></span>
                    <h3 className="mt-4 text-lg font-semibold">{p.t}</h3>
                    <p className="mt-1.5 text-sm text-stone-warm">{p.d}</p>
                  </CardBody>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="container-x py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gold-dark">The problem</p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                Communities are rich in space and starved for support.
              </h2>
              <p className="mt-4 text-ink/70">
                Every neighborhood holds buildings full of good rooms — and most stand dark and locked
                the moment the weekend ends. Meanwhile the groups that would fill them — a youth theater,
                a quilting guild, a meal program, a family looking for a place to gather — can't find an
                affordable door that's open to them.
              </p>
              <p className="mt-4 text-ink/70">
                The software meant to fix this is built for the largest, best-resourced institutions:
                expensive, complicated, and quick to take a fifth of every booking. So the spaces stay
                empty, the budgets stay tight, and the community goes without.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Building2, t: 'Buildings sit idle', d: 'Halls, kitchens, classrooms, and gyms unused 80–90% of the week.' },
                { icon: Banknote, t: 'Budgets stay tight', d: 'Real income is left on the table while bills keep coming.' },
                { icon: Users, t: 'Neighbors locked out', d: 'Local groups can\'t find an affordable, welcoming place to meet.' },
                { icon: TrendingUp, t: 'Tools take too much', d: 'Existing platforms charge up to 20% per booking — or $180/mo.' },
              ].map((c, i) => (
                <Card key={i} className="h-full">
                  <CardBody>
                    <c.icon className="h-6 w-6 text-primary" />
                    <h3 className="mt-3 font-semibold">{c.t}</h3>
                    <p className="mt-1 text-sm text-stone-warm">{c.d}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-20">
        <div className="container-x">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-gold-dark">How it works</p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Three steps to an open door.</h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', icon: DoorOpen, t: 'List your spaces', d: 'Add your rooms, set rates and rules, and publish a beautiful public page in minutes. AI helps you write descriptions and policies.' },
              { n: '02', icon: CalendarCheck, t: 'Welcome requests', d: 'Renters book online. You approve with a tap — with double-booking, insurance, and agreement checks handled for you.' },
              { n: '03', icon: Banknote, t: 'Get paid, automatically', d: 'Money lands in your account through Stripe, minus a transparent 1.5%. No invoices to chase, no checks to deposit.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <Card className="relative h-full overflow-hidden">
                  <CardBody className="space-y-3">
                    <span className="tabular absolute right-5 top-4 font-display text-4xl font-bold text-black/5">{s.n}</span>
                    <span className="grid h-11 w-11 place-items-center rounded-card bg-primary-50 text-primary"><s.icon className="h-5 w-5" /></span>
                    <h3 className="text-lg font-semibold">{s.t}</h3>
                    <p className="text-sm text-stone-warm">{s.d}</p>
                  </CardBody>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container-x py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-dark">Everything they need, nothing they don't</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">A real operations platform, priced for access.</h2>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: CalendarCheck, t: 'Calendar & bookings', d: 'A clean calendar, approval workflows, and conflict-proof scheduling with buffer times.' },
            { icon: ShieldCheck, t: 'Compliance, automated', d: 'Collect certificates of insurance and signed use agreements. Expiry reminders sent for you.' },
            { icon: Banknote, t: 'Instant payouts', d: 'Stripe Connect routes funds straight to you with a transparent platform fee shown every time.' },
            { icon: Sparkles, t: 'AI helpers', d: 'Draft agreements, descriptions, pricing guidance, and replies — always with a verify-first note.' },
            { icon: Building2, t: 'Public discovery', d: 'A polished page for your community and a network where renters find you by city and space.' },
            { icon: TrendingUp, t: 'Analytics that matter', d: 'Utilization, revenue, retention, and the most-loved spaces — at a glance.' },
          ].map((f, i) => (
            <Reveal key={i} delay={(i % 3) * 80}>
              <Card className="group h-full transition hover:shadow-lift">
                <CardBody>
                  <span className="grid h-11 w-11 place-items-center rounded-card bg-gold/15 text-gold-dark transition group-hover:bg-primary group-hover:text-white"><f.icon className="h-5 w-5" /></span>
                  <h3 className="mt-3 font-semibold">{f.t}</h3>
                  <p className="mt-1 text-sm text-stone-warm">{f.d}</p>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="mt-10 text-center">
            <Button variant="outline" onClick={() => navigate('/features')}>See every feature, live <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Reveal>
      </section>

      {/* THE MATH */}
      <section className="bg-ink py-20 text-white">
        <div className="container-x">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-gold-light">The honest math</p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">We grow only by helping you grow first.</h2>
              <p className="mt-4 text-white/70">
                A community renting <strong className="text-white">$2,000</strong> of space a month pays Sanctum about
                <strong className="text-gold-light"> $49</strong> all-in. The same month on a 20%-fee marketplace would cost
                <strong className="text-white"> $400+</strong>. That difference stays in the neighborhood, where it does the most good.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
              {[
                { who: 'Sanctum', cost: '$49', detail: '$19/mo + 1.5%', good: true },
                { who: '20% marketplace', cost: '$400', detail: 'on $2,000 of bookings', good: false },
                { who: 'Legacy software', cost: '$120+', detail: 'and you still chase checks', good: false },
              ].map((c) => (
                <div key={c.who} className={`rounded-card border p-6 text-center ${c.good ? 'border-gold-light/40 bg-white/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="text-sm text-white/60">{c.who}</div>
                  <div className={`tabular mt-2 text-4xl font-bold ${c.good ? 'text-gold-light' : 'text-white'}`}>{c.cost}<span className="text-base font-normal text-white/50">/mo</span></div>
                  <div className="mt-2 text-xs text-white/50">{c.detail}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="container-x py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-dark">Pricing</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Priced for access, not extraction.</h2>
            <p className="mt-3 text-ink/70">Start free for 30 days. No card required.</p>
          </div>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-3">
          {Object.values(PLAN_DETAILS).map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Card className={`h-full ${p.id === 'growth' ? 'ring-2 ring-primary' : ''}`}>
                <CardBody className="flex h-full flex-col">
                  {p.id === 'growth' && <Badge tone="primary" className="mb-2 self-start">Most popular</Badge>}
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-stone-warm">{p.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="tabular text-4xl font-bold">{formatCents(p.priceCents)}</span>
                    <span className="text-sm text-stone-warm">/month</span>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6" full variant={p.id === 'growth' ? 'primary' : 'outline'} asLink="/signup">
                    Start free
                  </Button>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-stone-warm">
          Every plan includes the transparent 1.5% per paid booking. <Link to="/pricing" className="font-medium text-primary hover:underline">See the full comparison →</Link>
        </p>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-white py-20">
        <div className="container-x">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Communities, in their own words.</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { q: 'We were leaving thousands on the table every month. Now the hall pays for the programs that fill it.', n: 'Grace O.', r: 'Community center director' },
              { q: 'Booking used to mean three phone calls and a paper check. Now a group requests, I tap approve, and we\'re done.', n: 'Daniel R.', r: 'Facilities volunteer' },
              { q: 'Our youth theater finally has an affordable home. The space was always there — Sanctum just opened the door.', n: 'Marcus B.', r: 'Renter & organizer' },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 90}>
                <Card className="h-full">
                  <CardBody className="flex h-full flex-col">
                    <div className="flex gap-0.5 text-gold">
                      {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                    </div>
                    <p className="mt-3 flex-1 text-ink/80">"{t.q}"</p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-50 text-sm font-semibold text-primary">{t.n[0]}</span>
                      <div>
                        <div className="text-sm font-semibold">{t.n}</div>
                        <div className="text-xs text-stone-warm">{t.r}</div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-stone-warm">Illustrative stories that reflect how communities use Sanctum.</p>
        </div>
      </section>

      {/* MISSION CTA */}
      <section className="container-x py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-white sm:px-16">
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gold/20 blur-3xl animate-blob" />
            <HeartHandshake className="mx-auto h-10 w-10 text-gold-light" />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
              When small communities have powerful tools, whole neighborhoods rise together.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/75">
              That belief is the whole company. We keep our take small on purpose, so the value stays
              where it's made — in the rooms, with the people who gather in them.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="gold" onClick={() => navigate('/signup')}>Open your doors</Button>
              <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate('/about')}>
                Read our mission
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </MarketingShell>
  );
}
