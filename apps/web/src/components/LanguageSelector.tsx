/** A compact globe dropdown for choosing a display language. */
import { useState } from 'react';
import { Languages, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { LANGS } from '../lib/translate.js';

export function LanguageSelector({
  value, onChange, busy, options,
}: {
  value: string;
  onChange: (name: string) => void;
  busy?: boolean;
  /** Restrict to a subset (by language name); defaults to the full list. */
  options?: { label: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const list = options ?? LANGS;
  const current = list.find((l) => l.name === value);

  return (
    <div className="relative" dir="ltr">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink/70 hover:border-primary/40 hover:text-primary">
        <Languages className="h-3.5 w-3.5" /> {value === 'English' ? 'Translate' : (current?.label || value)}
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 grid w-44 grid-cols-1 rounded-card border border-black/10 bg-white py-1 shadow-lift">
            {list.map((l) => (
              <button key={l.name} onClick={() => { setOpen(false); onChange(l.name); }} className={cn('flex items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-black/[0.04]', value === l.name && 'font-semibold text-primary')}>
                {l.label} {value === l.name && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
