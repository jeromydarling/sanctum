import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Sparkles, Undo2, ImagePlus, Save, Globe, ExternalLink, Wand2, Calendar, MapPin,
} from 'lucide-react';
import { Card, CardBody, Button, Input, Textarea, EmptyState, Spinner } from '../../components/ui.js';
import { ImageStudio } from '../../components/ImageStudio.js';
import { AiDisclaimer } from '../../components/AiDisclaimer.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { callAI } from '../../lib/ai.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import type { EventMicrosite } from '@sanctum/shared';

interface Content {
  headline?: string; date?: string; location?: string; body?: string;
  cta?: string; theme?: string; cover?: string;
}

const THEMES: Record<string, { name: string; from: string; to: string }> = {
  indigo: { name: 'Indigo', from: 'from-primary-600', to: 'to-primary-900' },
  gold: { name: 'Gold', from: 'from-gold', to: 'to-gold-dark' },
  evergreen: { name: 'Evergreen', from: 'from-success', to: 'to-[#1b4332]' },
  dusk: { name: 'Dusk', from: 'from-[#5b50ee]', to: 'to-[#c9a84c]' },
};

export default function SiteBuilder() {
  const { id } = useParams();
  const { user } = useAuth();
  const data = useStore((d) => d);
  const site = data.event_microsites.find((s) => s.id === id && s.renter_id === user!.id);

  const [content, setContent] = useState<Content>((site?.content as Content) || {});
  const [history, setHistory] = useState<Content[]>([]);
  const [command, setCommand] = useState('');
  const [studio, setStudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  if (!site) return <EmptyState title="Event page not found" action={<Button asLink="/renter/sites">Back</Button>} />;

  function pushHistory() { setHistory((h) => [...h, content].slice(-20)); }
  function set<K extends keyof Content>(k: K, v: Content[K]) { setContent((c) => ({ ...c, [k]: v })); }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setContent(prev);
      return h.slice(0, -1);
    });
  }

  async function generateCopy() {
    setAiBusy(true);
    pushHistory();
    const fallback = `We can't wait to welcome you to ${content.headline || 'our event'}${content.location ? ` at ${content.location}` : ''}. Come share the evening with your neighbors — there'll be good company and a warm welcome for everyone. Doors open a half hour early; light refreshments to follow.`;
    const text = await callAI('site-write', { title: content.headline || site!.title, date: content.date, location: content.location }, fallback);
    set('body', text);
    setAiBusy(false);
    toast.success('Draft written');
  }

  async function runCommand() {
    if (!command.trim()) return;
    setAiBusy(true);
    pushHistory();
    const current = content.body || '';
    const fallback = current; // if AI unavailable, leave copy unchanged
    const text = await callAI('site-command', { current, instruction: command }, fallback);
    set('body', text);
    if (text === current) toast.info('AI is in demo mode — try editing directly.');
    else toast.success('Updated with your command');
    setCommand('');
    setAiBusy(false);
  }

  async function save(publish?: boolean) {
    setBusy(true);
    try {
      const updated: EventMicrosite = {
        ...site!, title: content.headline || site!.title, content: content as Record<string, unknown>,
        is_published: publish === undefined ? site!.is_published : publish ? 1 : 0,
        updated_at: new Date().toISOString(),
      };
      await wt('event_microsites', updated);
      toast.success(publish ? 'Published!' : 'Saved');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  const theme = THEMES[content.theme || 'indigo'] || THEMES.indigo;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/renter/sites" className="inline-flex items-center gap-1 text-sm text-stone-warm hover:text-ink"><ArrowLeft className="h-4 w-4" /> Event pages</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /> Undo</Button>
          {site.is_published === 1 && <Button variant="outline" size="sm" asLink={`/e/${site.slug}`}><ExternalLink className="h-4 w-4" /> View live</Button>}
          <Button variant="outline" size="sm" loading={busy} onClick={() => save()}><Save className="h-4 w-4" /> Save</Button>
          <Button size="sm" loading={busy} onClick={() => save(site.is_published !== 1)}><Globe className="h-4 w-4" /> {site.is_published === 1 ? 'Unpublish' : 'Publish'}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card><CardBody className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-primary" /> AI website builder</div>
            <Button variant="secondary" full onClick={generateCopy} loading={aiBusy}><Sparkles className="h-4 w-4" /> Write my event copy</Button>
            <div className="flex gap-2">
              <input
                className="input-base flex-1"
                placeholder='Try: "make it warmer and mention free parking"'
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runCommand()}
              />
              <Button onClick={runCommand} loading={aiBusy}>Apply</Button>
            </div>
            <AiDisclaimer />
          </CardBody></Card>

          <Card><CardBody className="space-y-3">
            <Input label="Headline" value={content.headline || ''} onChange={(e) => { set('headline', e.target.value); }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Date & time" value={content.date || ''} onChange={(e) => set('date', e.target.value)} />
              <Input label="Location" value={content.location || ''} onChange={(e) => set('location', e.target.value)} />
            </div>
            <Textarea label="Body" className="min-h-[160px]" value={content.body || ''} onChange={(e) => set('body', e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Button label" value={content.cta || ''} onChange={(e) => set('cta', e.target.value)} placeholder="RSVP" />
              <div>
                <span className="mb-1.5 block text-sm font-medium">Theme</span>
                <div className="flex gap-2">
                  {Object.entries(THEMES).map(([k, t]) => (
                    <button key={k} onClick={() => set('theme', k)} className={cn('h-8 w-8 rounded-full bg-gradient-to-br', t.from, t.to, content.theme === k && 'ring-2 ring-offset-2 ring-primary')} title={t.name} />
                  ))}
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setStudio(true)}><ImagePlus className="h-4 w-4" /> Cover image</Button>
          </CardBody></Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-warm">Live preview</p>
          <Card className="overflow-hidden">
            <div className={cn('relative grid h-48 place-items-end bg-gradient-to-br p-5 text-white', theme.from, theme.to)}>
              {content.cover && <img src={content.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
              <div className="relative">
                <h1 className="font-display text-2xl font-bold drop-shadow">{content.headline || site.title}</h1>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-white/90">
                  {content.date && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {content.date}</span>}
                  {content.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {content.location}</span>}
                </div>
              </div>
            </div>
            <CardBody>
              {aiBusy ? <div className="flex items-center gap-2 text-sm text-stone-warm"><Spinner className="h-4 w-4" /> Writing…</div> : (
                <p className="whitespace-pre-wrap leading-relaxed text-ink/80">{content.body || 'Your event description appears here.'}</p>
              )}
              <Button className="mt-5" style={{ pointerEvents: 'none' }}>{content.cta || 'RSVP'}</Button>
            </CardBody>
          </Card>
          {site.is_published === 1 && <p className="mt-2 text-center text-xs text-stone-warm">Live at <span className="font-mono">sanctum.garden/e/{site.slug}</span></p>}
        </div>
      </div>

      <ImageStudio open={studio} onClose={() => setStudio(false)} suggestedPrompt={`event backdrop for ${content.headline || site.title}`} onApply={(url) => { pushHistory(); set('cover', url); }} />
    </div>
  );
}
