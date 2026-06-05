import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';
import { MarketingShell, Footer } from '../../components/marketing/Footer.js';
import { MarketingNav } from '../../components/marketing/MarketingNav.js';
import { SmartImage } from '../../components/SmartImage.js';
import { Spinner, EmptyState, Button } from '../../components/ui.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';
import { LANGS, RTL_LANGS } from '../../lib/translate.js';
import { api } from '../../lib/api.js';

interface LangContent { headline?: string; body?: string; cta?: string; }
interface Site {
  id: string; slug: string; title: string;
  content: {
    headline?: string; body?: string; date?: string; location?: string; cover?: string; cta?: string;
    translations?: Record<string, LangContent>;
  };
}

export default function EventMicrosite() {
  const { slug } = useParams();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('English');

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ site: Site }>(`/public/event/${slug}`, { auth: false });
        setSite(res.site);
      } catch { setSite(null); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  if (!site) {
    return (
      <MarketingShell><MarketingNav />
        <div className="container-x py-24"><EmptyState title="Event page not found" body="This event page may be unpublished or moved." action={<Button asLink="/find">Find a space</Button>} /></div>
        <Footer />
      </MarketingShell>
    );
  }
  const c = site.content || {};
  const translations = c.translations || {};
  // Only offer the languages the host actually authored.
  const available = LANGS.filter((l) => l.name === 'English' || translations[l.name]);
  const tr = lang === 'English' ? c : { ...c, ...(translations[lang] || {}) };
  const rtl = RTL_LANGS.has(lang);

  return (
    <MarketingShell><MarketingNav />
      <div className="relative h-72">
        <SmartImage src={c.cover} alt={site.title} emoji="🎉" seed={site.id} className="h-full w-full" width={1600} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <div className="container-x absolute bottom-6 left-1/2 -translate-x-1/2 text-white" dir={rtl ? 'rtl' : 'ltr'}>
          <h1 className="font-display text-4xl font-bold">{tr.headline || site.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-white/85">
            {c.date && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {c.date}</span>}
            {c.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {c.location}</span>}
          </div>
        </div>
      </div>
      <div className="container-x max-w-2xl py-12">
        {available.length > 1 && (
          <div className="mb-4 flex justify-end"><LanguageSelector value={lang} onChange={setLang} options={available} /></div>
        )}
        <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink/80" dir={rtl ? 'rtl' : 'ltr'}>{tr.body || 'Join us for this community event.'}</p>
        <Button className="mt-8" size="lg">{tr.cta || c.cta || 'RSVP'}</Button>
      </div>
      <Footer />
    </MarketingShell>
  );
}
