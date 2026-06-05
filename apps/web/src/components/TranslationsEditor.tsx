import { useState } from 'react';
import { toast } from 'sonner';
import { Languages, Trash2 } from 'lucide-react';
import { Textarea } from './ui.js';
import { AiDisclaimer } from './AiDisclaimer.js';
import { translateBatch, LANGS, RTL_LANGS } from '../lib/translate.js';
import type { AuthoredTranslations } from '@sanctum/shared';

/**
 * Lets an operator pre-translate a single description field at save-time.
 * AI drafts each language from the English source; every draft is editable
 * before it's saved. Stored as { [language]: { description } }.
 */
export function TranslationsEditor({
  source,
  value,
  onChange,
  label = 'Translate for your neighbors',
  hint = 'Pre-translate so visitors see a perfect version instantly — no waiting, no machine translation on the page. AI drafts each one; edit anything before you save.',
}: {
  source: string;
  value: AuthoredTranslations | undefined;
  onChange: (next: AuthoredTranslations) => void;
  label?: string;
  hint?: string;
}) {
  const translations = value || {};
  const [busyLang, setBusyLang] = useState<string | null>(null);

  async function addLanguage(ln: string) {
    if (!source.trim()) { toast.error('Write a description first, then translate it.'); return; }
    setBusyLang(ln);
    try {
      const [description] = await translateBatch([source], ln);
      onChange({ ...translations, [ln]: { description } });
      toast.success(`Added ${LANGS.find((l) => l.name === ln)?.label || ln}`);
    } finally {
      setBusyLang(null);
    }
  }

  function setText(ln: string, description: string) {
    onChange({ ...translations, [ln]: { ...translations[ln], description } });
  }

  function removeLang(ln: string) {
    const next = { ...translations };
    delete next[ln];
    onChange(next);
  }

  const added = Object.keys(translations);

  return (
    <div className="rounded-card border border-black/10 bg-black/[0.015] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4 text-primary" /> {label}</div>
      <p className="mt-1 text-xs text-stone-warm">{hint}</p>

      {added.map((ln) => (
        <div key={ln} className="mt-3 rounded-card border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{LANGS.find((l) => l.name === ln)?.label || ln}</span>
            <button type="button" onClick={() => removeLang(ln)} className="text-stone-warm hover:text-danger" title="Remove"><Trash2 className="h-4 w-4" /></button>
          </div>
          <Textarea
            value={translations[ln]?.description || ''}
            onChange={(e) => setText(ln, e.target.value)}
            dir={RTL_LANGS.has(ln) ? 'rtl' : 'ltr'}
            placeholder="Translated description…"
          />
        </div>
      ))}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {LANGS.filter((l) => l.name !== 'English' && !translations[l.name]).map((l) => (
          <button
            key={l.name}
            type="button"
            onClick={() => addLanguage(l.name)}
            disabled={!!busyLang}
            className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-ink/70 hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {busyLang === l.name ? 'Translating…' : `+ ${l.label}`}
          </button>
        ))}
      </div>
      <div className="mt-2"><AiDisclaimer /></div>
    </div>
  );
}
