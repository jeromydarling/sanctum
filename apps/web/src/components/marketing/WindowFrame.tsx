/** A minimal, chromeless browser window frame for rendering live mini-previews. */
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export function WindowFrame({ url, children, className }: { url?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-black/10 bg-white shadow-lift', className)}>
      <div className="flex items-center gap-2 border-b border-black/5 bg-cream/70 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        {url && (
          <span className="ml-2 flex-1 truncate rounded-md bg-white px-2.5 py-0.5 text-center text-[11px] text-stone-warm ring-1 ring-black/5">
            {url}
          </span>
        )}
      </div>
      <div className="relative overflow-hidden bg-cream">{children}</div>
    </div>
  );
}
