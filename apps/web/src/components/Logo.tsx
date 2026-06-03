import { Link } from 'react-router-dom';
import { cn } from '../lib/cn.js';

export function Logo({ className, mark = true, to = '/' }: { className?: string; mark?: boolean; to?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 font-display text-xl font-bold text-ink', className)}>
      {mark && (
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-gold-light shadow-sm">
          <svg viewBox="0 0 100 100" className="h-5 w-5" aria-hidden>
            <path d="M50 20 L78 41 V80 H60 V58 H40 V80 H22 V41 Z" fill="currentColor" />
          </svg>
        </span>
      )}
      <span>Sanctum</span>
    </Link>
  );
}
