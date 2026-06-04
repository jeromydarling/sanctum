import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Users2, Building2 } from 'lucide-react';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { SmartImage } from '../../components/SmartImage.js';
import { Card, Badge, Spinner, EmptyState, Button } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { formatCents, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI, type SpaceType } from '@sanctum/shared';

interface NetSpace { id: string; name: string; space_type: SpaceType; capacity_persons: number | null; hourly_rate_cents: number | null; images: string[]; pricing_mode?: string; }
interface NetFacility { id: string; name: string; slug: string; city: string; state: string; cover_image_url: string | null; spaces: NetSpace[]; }
interface Network { name: string; slug: string; description: string | null; brand_primary: string; logo_url: string | null; }

export default function NetworkPage() {
  const { slug } = useParams();
  const [data, setData] = useState<{ network: Network; facilities: NetFacility[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api(`/public/network/${slug}`, { auth: false })); }
      catch { setData(null); } finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  if (!data) {
    return (
      <MarketingShell>
        <div className="container-x py-24"><EmptyState title="Network not found" body="This network page may have moved." action={<Button asLink="/find">Find a space</Button>} /></div>
        <Footer />
      </MarketingShell>
    );
  }

  const { network, facilities } = data;
  const brand = network.brand_primary || '#4338ca';
  const totalSpaces = facilities.reduce((n, f) => n + f.spaces.length, 0);

  return (
    <MarketingShell>
      {/* Branded header (white-label) */}
      <header className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
        <div className="container-x py-16 text-center">
          {network.logo_url
            ? <img src={network.logo_url} alt={network.name} className="mx-auto mb-5 h-16 w-16 rounded-2xl object-cover" />
            : <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white/15"><Building2 className="h-8 w-8" /></span>}
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{network.name}</h1>
          {network.description && <p className="mx-auto mt-4 max-w-2xl text-white/85">{network.description}</p>}
          <div className="mt-5 flex justify-center gap-3 text-sm">
            <span className="rounded-full bg-white/15 px-3 py-1">{facilities.length} communities</span>
            <span className="rounded-full bg-white/15 px-3 py-1">{totalSpaces} spaces</span>
          </div>
        </div>
      </header>

      <section className="container-x py-12">
        {facilities.length === 0 ? (
          <EmptyState icon={<Building2 className="h-8 w-8" />} title="No spaces listed yet" body="Communities in this network will appear here." />
        ) : (
          <div className="space-y-10">
            {facilities.map((f) => (
              <div key={f.id}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold">{f.name}</h2>
                    <p className="flex items-center gap-1 text-sm text-stone-warm"><MapPin className="h-3.5 w-3.5" /> {f.city}, {f.state}</p>
                  </div>
                  <Link to={`/c/${f.slug}`} className="text-sm font-medium hover:underline" style={{ color: brand }}>View community →</Link>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {f.spaces.map((s) => (
                    <Link key={s.id} to={`/c/${f.slug}`}>
                      <Card className="overflow-hidden transition hover:shadow-lift">
                        <SmartImage src={s.images?.[0]} alt={s.name} emoji={SPACE_TYPE_EMOJI[s.space_type]} seed={s.id} className="h-40 w-full" />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold">{s.name}</h3>
                            <Badge tone="gold">{SPACE_TYPE_LABELS[s.space_type]}</Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1 text-stone-warm"><Users2 className="h-3.5 w-3.5" /> {s.capacity_persons ?? '—'}</span>
                            <span className="tabular font-semibold" style={{ color: brand }}>{s.pricing_mode === 'free' ? 'Free' : s.pricing_mode === 'donation' ? 'Donation' : s.hourly_rate_cents ? `${formatCents(s.hourly_rate_cents)}/hr` : 'Inquire'}</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="container-x pb-10 text-center text-xs text-stone-warm">Powered by Sanctum · Open doors. Stronger communities.</div>
      <Footer />
    </MarketingShell>
  );
}
