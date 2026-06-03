import { Check, X, Minus } from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { Reveal } from '../../components/Reveal.js';
import { Button, Card, CardBody, Badge } from '../../components/ui.js';
import { formatCents, PLAN_DETAILS } from '@sanctum/shared';

interface Row { name: string; monthly: string; fee: string; stripe: boolean | 'addon'; coi: boolean; highlight?: boolean }
const COMPARISON: Row[] = [
  { name: 'Sanctum', monthly: '$9–$29', fee: '1.5%', stripe: true, coi: true, highlight: true },
  { name: 'ChurchSpace', monthly: 'Free to list', fee: '20%', stripe: true, coi: false },
  { name: 'eSPACE', monthly: '$60–$180', fee: 'Manual billing', stripe: false, coi: true },
  { name: 'SpaceTogether', monthly: '$150', fee: 'Undisclosed', stripe: true, coi: false },
  { name: 'Skedda', monthly: 'Free–$$', fee: '+$25/mo for Stripe', stripe: 'addon', coi: false },
];

export default function Pricing() {
  return (
    <MarketingShell>
      <MarketingNav />
      <section className="container-x py-16 text-center sm:py-20">
        <Reveal>
          <Badge tone="gold" className="mb-4">Priced for access, not extraction</Badge>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Honest pricing, in plain sight.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/70">
            A near-free monthly plan and a transparent 1.5% on paid bookings — shown as a line item every
            time, never hidden. 30-day free trial on every plan. No card required to start.
          </p>
        </Reveal>
      </section>

      <section className="container-x pb-8">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
          {Object.values(PLAN_DETAILS).map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Card className={`h-full ${p.id === 'growth' ? 'ring-2 ring-primary' : ''}`}>
                <CardBody className="flex h-full flex-col">
                  {p.id === 'growth' && <Badge tone="primary" className="mb-2 self-start">Most popular</Badge>}
                  <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-stone-warm">{p.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="tabular text-4xl font-bold">{formatCents(p.priceCents)}</span>
                    <span className="text-sm text-stone-warm">/month</span>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6" full variant={p.id === 'growth' ? 'primary' : 'outline'} asLink="/signup">Start free</Button>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-x py-16">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-bold">How we compare.</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink/70">The same $500 hall rental loses $100 on a 20% platform. With Sanctum it costs $7.50.</p>
        </Reveal>
        <Reveal delay={100}>
          <div className="mx-auto mt-10 max-w-4xl overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left">
                  <th className="py-3 pr-4 font-semibold">Platform</th>
                  <th className="py-3 px-4 font-semibold">Monthly</th>
                  <th className="py-3 px-4 font-semibold">Booking fee</th>
                  <th className="py-3 px-4 text-center font-semibold">Built-in payments</th>
                  <th className="py-3 px-4 text-center font-semibold">Insurance tracking</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.name} className={`border-b border-black/5 ${row.highlight ? 'bg-primary-50/50' : ''}`}>
                    <td className="py-4 pr-4 font-semibold">
                      {row.name} {row.highlight && <Badge tone="primary" className="ml-1">You're here</Badge>}
                    </td>
                    <td className="py-4 px-4 tabular">{row.monthly}</td>
                    <td className={`py-4 px-4 tabular font-semibold ${row.highlight ? 'text-success' : row.fee === '20%' ? 'text-danger' : ''}`}>{row.fee}</td>
                    <td className="py-4 px-4 text-center">{cell(row.stripe)}</td>
                    <td className="py-4 px-4 text-center">{cell(row.coi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-stone-warm">
          Competitor details are based on publicly available pricing and may change. Sanctum's white-label
          option for diocesan, denominational, and municipal networks is available — one agreement can cover hundreds of locations.
        </p>
      </section>
      <Footer />
    </MarketingShell>
  );
}

function cell(v: boolean | 'addon') {
  if (v === 'addon') return <Minus className="mx-auto h-4 w-4 text-warning" />;
  return v ? <Check className="mx-auto h-4 w-4 text-success" /> : <X className="mx-auto h-4 w-4 text-stone-warm/50" />;
}
