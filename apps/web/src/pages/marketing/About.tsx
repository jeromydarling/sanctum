import { HeartHandshake, Users, Sprout, Scale, HandCoins, Building2 } from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { Reveal } from '../../components/Reveal.js';
import { Button } from '../../components/ui.js';

const PRINCIPLES = [
  { icon: Users, t: 'The dignity of every community', d: 'Every group that gathers — to learn, to celebrate, to serve a meal — is doing real and worthy work. Our tools treat the smallest community with the same seriousness as the largest institution.' },
  { icon: HeartHandshake, t: 'Solidarity — we rise together', d: 'A space and the groups it shelters flourish in common. When a building opens its doors, the whole neighborhood is stronger for it. We build for that shared flourishing, not for any one party at the expense of another.' },
  { icon: Scale, t: 'Subsidiarity — power to the local', d: 'Decisions and tools belong as close to the ground as possible. We put genuinely powerful software directly in the hands of small, local communities — no IT department, no consultant, no enterprise contract required.' },
  { icon: Building2, t: 'Stewardship of shared space', d: 'A hall sitting empty six days a week is a gift waiting to be given. Caring for what we hold in common — and making it available for the good of all — is one of the most practical forms of generosity there is.' },
  { icon: Sprout, t: 'We grow by helping others grow first', d: 'Our success is downstream of yours. If a community isn\'t thriving, we haven\'t done our job. So we measure ourselves by the doors we help open, not the fees we collect.' },
  { icon: HandCoins, t: 'Priced for access, not extraction', d: 'We deliberately keep our take small — a near-free plan and a transparent 1.5%. The value created in a room should stay with the people who created it.' },
];

export default function About() {
  return (
    <MarketingShell>
      <MarketingNav />
      <section className="relative overflow-hidden">
        <div className="mesh-gradient absolute inset-0 -z-10" />
        <div className="container-x py-20 text-center sm:py-28">
          <Reveal>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">
              We believe a neighborhood gets stronger when its doors are open.
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ink/70">
              Sanctum exists for a simple reason: communities are surrounded by good spaces that go
              unused, and by neighbors who have nowhere affordable to gather. We close that gap — and
              we do it on terms that keep the value where it belongs.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-ink/80">
          <Reveal><p>
            Most software in this space was built for the institutions that need the least help — the
            largest, best-funded, most technical. It's expensive, it's complicated, and it quietly takes
            a fifth of every dollar that changes hands. The result is predictable: the spaces that could
            do the most good stay locked, because opening them isn't worth the cost or the hassle.
          </p></Reveal>
          <Reveal><p>
            We started from the opposite end. What would it take for the smallest community — run by
            volunteers, on a shoestring — to open its doors with confidence? It would take tools that are
            genuinely simple, compliance that handles itself, money that arrives automatically, and a
            price so fair it's never a reason to say no. That's the whole product.
          </p></Reveal>
          <Reveal><p>
            The principles below are our compass. They're old ideas about how people flourish together,
            translated into plain terms and built into software. You don't have to share any particular
            belief to use Sanctum — you only have to want your community to thrive.
          </p></Reveal>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="container-x">
          <Reveal><h2 className="text-center font-display text-3xl font-bold sm:text-4xl">What we build on.</h2></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={i} delay={(i % 3) * 80}>
                <div className="h-full rounded-card border border-black/5 bg-cream p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-card bg-primary text-gold-light"><p.icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-lg font-semibold">{p.t}</h3>
                  <p className="mt-2 text-sm text-stone-warm">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-20 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold sm:text-4xl">Open doors. Stronger communities.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink/70">It's our tagline because it's our entire reason for being. Come build it with us.</p>
          <div className="mt-8"><Button size="lg" asLink="/signup">Open your doors</Button></div>
        </Reveal>
      </section>
      <Footer />
    </MarketingShell>
  );
}
