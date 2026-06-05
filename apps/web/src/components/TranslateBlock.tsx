/** Translate a block of prose into a reader's language with Cloudflare Workers AI
 *  (Llama). Welcoming non-English speakers is hospitality, on-mission. */
import { useState } from 'react';
import { Languages, Check, Loader2 } from 'lucide-react';
import { callAI } from '../lib/ai.js';
import { cn } from '../lib/cn.js';

const LANGS: { label: string; name: string }[] = [
  { label: 'English', name: 'English' },
  { label: 'Español', name: 'Spanish' },
  { label: 'Français', name: 'French' },
  { label: 'Tiếng Việt', name: 'Vietnamese' },
  { label: 'Tagalog', name: 'Tagalog' },
  { label: '한국어', name: 'Korean' },
  { label: '中文', name: 'Chinese (Simplified)' },
  { label: 'Português', name: 'Portuguese' },
  { label: 'Kreyòl', name: 'Haitian Creole' },
  { label: 'العربية', name: 'Arabic' },
];

export function TranslateBlock({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('English');
  const [cache, setCache] = useState<Record<string, string>>({ English: text });
  const [busy, setBusy] = useState(false);

  async function pick(name: string) {
    setOpen(false);
    setLang(name);
    if (cache[name]) return;
    setBusy(true);
    const translated = await callAI('translate', { text, target_language: name }, text);
    setCache((c) => ({ ...c, [name]: translated }));
    setBusy(false);
  }

  const shown = cache[lang] ?? text;

  return (
    <div className={className}>
      <div className="relative mb-2 flex justify-end">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink/70 hover:border-primary/40 hover:text-primary" dir="ltr">
          <Languages className="h-3.5 w-3.5" /> {lang === 'English' ? 'Translate' : lang}
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 grid w-44 grid-cols-1 rounded-card border border-black/10 bg-white py-1 shadow-lift" dir="ltr">
              {LANGS.map((l) => (
                <button key={l.name} onClick={() => pick(l.name)} className={cn('flex items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-black/[0.04]', lang === l.name && 'font-semibold text-primary')}>
                  {l.label} {lang === l.name && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div dir={lang === 'Arabic' ? 'rtl' : 'ltr'} className={cn(busy && 'opacity-50 transition')}>
        <p className="whitespace-pre-wrap leading-relaxed">{shown}</p>
      </div>
      {lang !== 'English' && !busy && <p className="mt-1 text-right text-[11px] text-stone-warm" dir="ltr">Translated by AI · <button onClick={() => setLang('English')} className="underline">show original</button></p>}
    </div>
  );
}
