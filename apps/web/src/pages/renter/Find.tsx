import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Users2, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { SmartImage } from '../../components/SmartImage.js';
import { Card, Button, Input, Select, Badge, Skeleton, EmptyState } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { formatCents, SPACE_TYPES, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI, type SpaceType } from '@sanctum/shared';

interface PublicSpace { id: string; name: string; space_type: SpaceType; capacity_persons: number | null; hourly_rate_cents: number | null; images: string[]; }
interface PublicFacility { id: string; name: string; slug: string; city: string; state: string; spaces: PublicSpace[]; }

export default function Find() {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState<PublicFacility[] | null>(null);
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (type) params.set('type', type);
      const data = await api<{ facilities: PublicFacility[] }>(`/public/discover?${params}`, { auth: false });
      setFacilities(data.facilities);
    } catch { setFacilities([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <PageHeader title="Find a space" subtitle="Discover welcoming community spaces for your next gathering." />
      <Card className="mb-6 p-3 sm:flex sm:items-end sm:gap-3">
        <div className="flex-1"><Input label="City" placeholder="Minneapolis" value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div className="mt-3 sm:mt-0 sm:w-48">
          <Select label="Space type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            {SPACE_TYPES.map((t) => <option key={t} value={t}>{SPACE_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
        <Button className="mt-3 sm:mt-0" onClick={load}><Search className="h-4 w-4" /> Search</Button>
      </Card>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : !facilities?.length ? (
        <EmptyState icon={<SlidersHorizontal className="h-8 w-8" />} title="No spaces match" body="Try a different city or space type." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.flatMap((f) => f.spaces.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <SmartImage src={s.images?.[0]} alt={s.name} emoji={SPACE_TYPE_EMOJI[s.space_type]} seed={s.id} className="h-40 w-full" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge tone="gold">{SPACE_TYPE_LABELS[s.space_type]}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-stone-warm"><MapPin className="h-3 w-3" /> {f.name} · {f.city}, {f.state}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm text-stone-warm"><Users2 className="h-3.5 w-3.5" /> {s.capacity_persons ?? '—'}</span>
                  <span className="tabular text-sm font-semibold text-primary-700">{s.hourly_rate_cents ? `${formatCents(s.hourly_rate_cents)}/hr` : 'Inquire'}</span>
                </div>
                <Button className="mt-3" full onClick={() => navigate(`/book/${f.id}/${s.id}`)}>Request this space</Button>
              </div>
            </Card>
          )))}
        </div>
      )}
    </div>
  );
}
