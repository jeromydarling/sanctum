/** Hand-rolled shadcn-style UI primitives. */
import {
  forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode, useEffect,
} from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.js';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  outline: 'border border-black/15 bg-white text-ink hover:bg-black/[0.03]',
  ghost: 'text-ink hover:bg-black/[0.04]',
  danger: 'bg-danger text-white hover:bg-danger/90',
  gold: 'bg-gold text-ink hover:bg-gold-dark hover:text-white shadow-sm',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base py-3.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asLink?: string;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, asLink, full, className, children, disabled, ...rest },
  ref,
) {
  const classes = cn('btn', VARIANTS[variant], SIZES[size], full && 'w-full', className);
  if (asLink) {
    return (
      <Link to={asLink} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
        <input ref={ref} id={id} className={cn('input-base', error && 'border-danger focus:ring-danger/30', className)} {...rest} />
        {hint && !error && <span className="mt-1 block text-xs text-stone-warm">{hint}</span>}
        {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }>(
  function Textarea({ label, hint, className, ...rest }, ref) {
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
        <textarea ref={ref} className={cn('input-base min-h-[96px] resize-y', className)} {...rest} />
        {hint && <span className="mt-1 block text-xs text-stone-warm">{hint}</span>}
      </label>
    );
  },
);

export function Select({ label, hint, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      <select className={cn('input-base appearance-none bg-white pr-9', className)} {...rest}>
        {children}
      </select>
      {hint && <span className="mt-1 block text-xs text-stone-warm">{hint}</span>}
    </label>
  );
}

type Tone = 'neutral' | 'primary' | 'gold' | 'success' | 'warning' | 'danger';
const TONES: Record<Tone, string> = {
  neutral: 'bg-black/[0.06] text-ink/70',
  primary: 'bg-primary-50 text-primary-700',
  gold: 'bg-gold/15 text-gold-dark',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-[#9a6a00]',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-[fade-up_0.2s_ease]" onClick={onClose} />
      <div className={cn('relative z-10 w-full rounded-t-2xl bg-white shadow-lift sm:rounded-2xl', widths[size], 'animate-fade-up max-h-[92vh] overflow-y-auto')}>
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-black/5 bg-white/95 px-6 py-4 backdrop-blur">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-stone-warm hover:bg-black/5" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-card', className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-black/10 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-primary/70">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-stone-warm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'primary' }: { label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-warm">{label}</p>
        <p className={cn('tabular text-2xl font-bold', tone === 'primary' && 'text-primary-700', tone === 'success' && 'text-success', tone === 'gold' && 'text-gold-dark')}>{value}</p>
        {sub && <p className="text-xs text-stone-warm">{sub}</p>}
      </CardBody>
    </Card>
  );
}
