import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin, Users2, Star, Phone, Globe, Mail, ArrowLeft, Check } from 'lucide-react';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { Footer, MarketingShell } from '../../components/marketing/Footer.js';
import { SmartImage } from '../../components/SmartImage.js';
import { Button, Card, CardBody, Badge, Input, Textarea, Spinner, EmptyState } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { notifyError } from '../../lib/errors.js';
import { formatCents, AMENITY_LABELS, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI, type SpaceType, type Amenity } from '@sanctum/shared';

interface PublicSpace {
  id: string; name: string; space_type: SpaceType; description: string | null;
  capacity_persons: number | null; hourly_rate_cents: number | null; half_day_rate_cents: number | null;
  full_day_rate_cents: number | null; images: string[]; amenities: string[];
}
interface Facility {
  id: string; name: string; slug: string; denomination: string | null; description: string | null;
  city: string; state: string; address: string; phone: string | null; email: string | null;
  website: string | null; cover_image_url: string | null; spaces: PublicSpace[];
}
interface Review { id: string; rating: number; headline: string | null; body: string | null; }

export default function PublicFacility() {
  const { slug } = useParams();
  const [data, setData] = useState<{ facility: Facility; reviews: Review[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ facility: Facility; reviews: Review[] }>(`/public/facility/${slug}`, { auth: false });
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <Centered><Spinner className="h-7 w-7" /></Centered>;
  if (notFound || !data) {
    return (
      <MarketingShell><MarketingNav />
        <div className="container-x py-24">
          <EmptyState title="We couldn't find that page" body="This community page may have moved or isn't listed publicly." action={<Button asLink="/find">Browse spaces</Button>} />
        </div>
        <Footer />
      </MarketingShell>
    );
  }

  const { facility, reviews } = data;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <MarketingShell>
      <MarketingNav />
      <div className="relative h-56 sm:h-72">
        <SmartImage src={facility.cover_image_url} alt={facility.name} emoji="⛪" seed={facility.id} className="h-full w-full" width={1600} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <div className="container-x absolute bottom-5 left-1/2 -translate-x-1/2 text-white">
          <Link to="/find" className="mb-2 inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> All spaces</Link>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{facility.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
            <MapPin className="h-4 w-4" /> {facility.city}, {facility.state}
            {facility.denomination && <span>· {facility.denomination}</span>}
            {avg > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold-light text-gold-light" /> {avg.toFixed(1)}</span>}
          </p>
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {facility.description && <p className="text-lg leading-relaxed text-ink/80">{facility.description}</p>}

          <h2 className="mt-10 font-display text-2xl font-bold">Spaces</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {facility.spaces.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <SmartImage src={s.images?.[0]} alt={s.name} emoji={SPACE_TYPE_EMOJI[s.space_type]} seed={s.id} className="h-40 w-full" />
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Badge tone="gold">{SPACE_TYPE_LABELS[s.space_type]}</Badge>
                  </div>
                  {s.description && <p className="mt-2 line-clamp-3 text-sm text-stone-warm">{s.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.amenities.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-ink/70">{AMENITY_LABELS[a as Amenity] || a}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-stone-warm"><Users2 className="h-4 w-4" /> up to {s.capacity_persons ?? '—'}</span>
                    <span className="tabular font-semibold text-primary-700">{s.hourly_rate_cents ? `${formatCents(s.hourly_rate_cents)}/hr` : 'Inquire'}</span>
                  </div>
                  <Button className="mt-4" full variant="outline" asLink="/signup">Request this space</Button>
                </CardBody>
              </Card>
            ))}
          </div>

          {reviews.length > 0 && (
            <>
              <h2 className="mt-12 font-display text-2xl font-bold">What renters say</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {reviews.map((r) => (
                  <Card key={r.id}><CardBody>
                    <div className="flex gap-0.5 text-gold">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                    {r.headline && <h4 className="mt-2 font-semibold">{r.headline}</h4>}
                    {r.body && <p className="mt-1 text-sm text-stone-warm">{r.body}</p>}
                  </CardBody></Card>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-5">
          <Card><CardBody className="space-y-3">
            <h3 className="font-semibold">Contact</h3>
            {facility.phone && <a href={`tel:${facility.phone}`} className="flex items-center gap-2 text-sm text-ink/80 hover:text-primary"><Phone className="h-4 w-4" /> {facility.phone}</a>}
            {facility.email && <a href={`mailto:${facility.email}`} className="flex items-center gap-2 text-sm text-ink/80 hover:text-primary"><Mail className="h-4 w-4" /> {facility.email}</a>}
            {facility.website && <a href={facility.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-ink/80 hover:text-primary"><Globe className="h-4 w-4" /> Website</a>}
            <p className="flex items-center gap-2 text-sm text-stone-warm"><MapPin className="h-4 w-4" /> {facility.address}</p>
          </CardBody></Card>
          <InquiryForm facilityId={facility.id} />
        </aside>
      </div>
      <Footer />
    </MarketingShell>
  );
}

function InquiryForm({ facilityId }: { facilityId: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', organization: '', message: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/public/inquiry', { auth: false, body: { facility_id: facilityId, ...form } });
      setSent(true);
      toast.success('Your message is on its way!');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card><CardBody className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><Check className="h-6 w-6" /></div>
        <h3 className="mt-3 font-semibold">Thank you!</h3>
        <p className="mt-1 text-sm text-stone-warm">The community will be in touch soon.</p>
      </CardBody></Card>
    );
  }
  return (
    <Card><CardBody>
      <h3 className="font-semibold">Ask about a space</h3>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Input placeholder="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Organization (optional)" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
        <Textarea placeholder="Tell them about your event…" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <Button type="submit" full loading={busy}>Send inquiry</Button>
      </form>
    </CardBody></Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center">{children}</div>;
}
