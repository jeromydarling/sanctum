import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Users2, SlidersHorizontal, List, Map as MapIcon } from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { SmartImage } from '../../components/SmartImage.js';
import { UsMap } from '../../components/UsMap.js';
import { Button, Card, Input, Select, Badge, Skeleton, EmptyState } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { formatCents, SPACE_TYPES, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI, type SpaceType } from '@sanctum/shared';

interface PublicSpace {
  id: string; name: string; space_type: SpaceType; capacity_persons: number | null;
  hourly_rate_cents: number | null; images: string[]; amenities: string[];
}
interface PublicFacility {
  id: string; name: string; slug: string; city: string; state: string;
  description: string | null; cover_image_url: string | null; spaces: PublicSpace[];
}

export default function Find() {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState<PublicFacility[] | null>(null);
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (type) params.set('type', type);
      if (capacity) params.set('capacity', capacity);
      const data = await api<{ facilities: PublicFacility[] }>(`/public/discover?${params}`, { auth: false });
      setFacilities(data.facilities);
    } catch {
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MarketingShell>
      <MarketingNav />
      <section className="relative overflow-hidden">
        <div className="mesh-gradient absolute inset-0 -z-10" />
        <div className="container-x py-14 text-center">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Find a space near you.</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink/70">Welcoming community halls, kitchens, classrooms, and more — ready for your next gathering.</p>
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-black/5 bg-white p-3 shadow-card sm:flex sm:items-end sm:gap-3">
            <div className="flex-1"><Input label="City or area" placeholder="Minneapolis" value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div className="mt-3 sm:mt-0 sm:w-44">
              <Select label="Space type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Any type</option>
                {SPACE_TYPES.map((t) => <option key={t} value={t}>{SPACE_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div className="mt-3 sm:mt-0 sm:w-32">
              <Input label="Min. capacity" type="number" placeholder="50" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <Button className="mt-3 sm:mt-0" size="md" onClick={load}><Search className="h-4 w-4" /> Search</Button>
          </div>
        </div>
      </section>

      <section className="container-x py-12">
        {!loading && !!facilities?.length && (
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-stone-warm">{facilities.length} communit{facilities.length === 1 ? 'y' : 'ies'} · {facilities.reduce((n, f) => n + f.spaces.length, 0)} spaces</p>
            <div className="inline-flex rounded-card border border-black/10 bg-white p-1">
              {(['list', 'map'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm font-medium capitalize', view === v ? 'bg-primary text-white' : 'text-ink/70')}>
                  {v === 'list' ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />} {v}
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && view === 'map' && !!facilities?.length && (
          <div className="mb-8">
            <UsMap pins={facilities.map((f) => ({ id: f.id, state: f.state, label: `${f.name} · ${f.city}, ${f.state}`, count: f.spaces.length, onClick: () => navigate(`/c/${f.slug}`) }))} />
          </div>
        )}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        ) : !facilities?.length ? (
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8" />}
            title="No spaces match yet"
            body="Try widening your search, or check back soon — new communities are opening their doors all the time."
            action={<Button variant="outline" onClick={() => { setCity(''); setType(''); setCapacity(''); load(); }}>Clear filters</Button>}
          />
        ) : view === 'map' ? null : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.flatMap((f) =>
              f.spaces.map((s) => (
                <Link key={s.id} to={`/c/${f.slug}`} className="group">
                  <Card className="h-full overflow-hidden transition hover:shadow-lift">
                    <SmartImage src={s.images?.[0]} alt={s.name} emoji={SPACE_TYPE_EMOJI[s.space_type]} seed={s.id} className="h-44 w-full" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight">{s.name}</h3>
                        <Badge tone="gold">{SPACE_TYPE_LABELS[s.space_type]}</Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-stone-warm"><MapPin className="h-3 w-3" /> {f.name} · {f.city}, {f.state}</p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-stone-warm"><Users2 className="h-3.5 w-3.5" /> {s.capacity_persons ?? '—'}</span>
                        <span className="tabular font-semibold text-primary-700">{s.hourly_rate_cents ? `${formatCents(s.hourly_rate_cents)}/hr` : 'Inquire'}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              )),
            )}
          </div>
        )}
      </section>
      <Footer />
    </MarketingShell>
  );
}
