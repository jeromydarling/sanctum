/**
 * Interactive product tour — coach-marks anchored to real UI.
 *
 * A tour is a list of steps; each step optionally points at a real element
 * (tagged `data-tour="key"`), which gets spotlit while a popover explains it.
 * Steps with no target render as a centered card (intros/outros). Everything is
 * on-demand: `TourButton` starts the tour for the section you're in; nothing
 * ever auto-opens.
 *
 * Accessibility: the popover is a focus-trapped dialog — Esc closes, ←/→ move
 * between steps, focus returns to the launcher on close.
 */
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Compass } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { TOURS, tourForPath, type TourDef } from './tours.js';

interface TourContextValue {
  start: (key: string) => void;
  activeKey: string | null;
}
const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within <TourProvider>');
  return ctx;
}

const POPOVER_W = 340;

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const launcherRef = useRef<HTMLElement | null>(null);

  const tour: TourDef | undefined = useMemo(
    () => TOURS.find((t) => t.key === activeKey),
    [activeKey],
  );

  const start = useCallback((key: string) => {
    const t = TOURS.find((x) => x.key === key);
    if (!t) return;
    launcherRef.current = (document.activeElement as HTMLElement) || null;
    setStepIndex(0);
    setActiveKey(key);
    // If the tour is rooted on a specific page, make sure we're there.
    if (t.route && location.pathname !== t.route) navigate(t.route);
  }, [location.pathname, navigate]);

  const close = useCallback(() => {
    setActiveKey(null);
    // Return focus to whatever launched the tour.
    const el = launcherRef.current;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  }, []);

  const value = useMemo(() => ({ start, activeKey }), [start, activeKey]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && (
        <TourRunner
          tour={tour}
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          onClose={close}
        />
      )}
    </TourContext.Provider>
  );
}

interface RunnerProps {
  tour: TourDef;
  stepIndex: number;
  setStepIndex: (n: number) => void;
  onClose: () => void;
}

function TourRunner({ tour, stepIndex, setStepIndex, onClose }: RunnerProps) {
  const steps = tour.steps;
  const step = steps[stepIndex];
  const rect = useTargetRect(step?.target, stepIndex);
  const popRef = useRef<HTMLDivElement>(null);
  const [popH, setPopH] = useState(180);

  const last = stepIndex >= steps.length - 1;
  const first = stepIndex <= 0;

  const go = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, n));
    setStepIndex(clamped);
  }, [steps, setStepIndex]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); last ? onClose() : go(stepIndex + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!first) go(stepIndex - 1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, stepIndex, first, last]);

  // Move focus into the popover when the step changes.
  useLayoutEffect(() => {
    if (popRef.current) {
      setPopH(popRef.current.offsetHeight);
      popRef.current.focus({ preventScroll: true });
    }
  }, [stepIndex]);

  const pos = usePopoverPosition(rect, popH);

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation" aria-live="polite">
      {/* Click-blocker: keeps focus on the tour instead of the underlying UI. */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Spotlight — a big translucent shadow with a rounded hole over the target. */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/80 transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(23, 23, 23, 0.55)',
          }}
        />
      )}
      {/* No target -> dim the whole screen (centered card). */}
      {!rect && <div className="absolute inset-0 bg-ink/55" />}

      {/* Popover */}
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="absolute w-[min(92vw,340px)] rounded-2xl border border-black/10 bg-white shadow-lift outline-none animate-fade-up"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-2.5 text-white">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Compass className="h-4 w-4" /> {tour.label}
          </span>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/15" aria-label="End tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <h3 id="tour-title" className="font-display text-lg font-bold">{step.title}</h3>
          <p id="tour-body" className="mt-1.5 text-sm text-stone-warm">{step.body}</p>

          <div className="mt-3 flex items-center gap-1" aria-hidden="true">
            {steps.map((_, j) => (
              <span key={j} className={cn('h-1.5 rounded-full transition-all', j === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-black/10')} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-stone-warm">{stepIndex + 1} of {steps.length}</span>
            <div className="flex gap-2">
              {!first && (
                <button
                  onClick={() => go(stepIndex - 1)}
                  className="btn border border-black/15 px-3 py-1.5 text-sm font-semibold hover:bg-black/5"
                  aria-label="Previous step"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              {last ? (
                <button onClick={onClose} className="btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">
                  Done
                </button>
              ) : (
                <button onClick={() => go(stepIndex + 1)} className="btn bg-primary px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Find the target for a step (polling briefly in case the page is still
 *  rendering / navigating), scroll it into view, and track its rect. */
function useTargetRect(target: string | undefined, stepIndex: number): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target) { setRect(null); return; }
    let raf = 0;
    let tries = 0;
    let cancelled = false;
    let scrolled = false;
    const find = () => document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);

    function sync() {
      const node = find();
      if (node) setRect(node.getBoundingClientRect());
    }
    function tick() {
      if (cancelled) return;
      const node = find();
      if (node) {
        if (!scrolled) { scrolled = true; node.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        setRect(node.getBoundingClientRect());
        // keep following for a moment while smooth-scroll settles
        if (tries++ < 40) raf = requestAnimationFrame(tick);
        return;
      }
      if (tries++ < 90) raf = requestAnimationFrame(tick); // ~1.5s grace, then centered
      else setRect(null);
    }
    tick();

    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [target, stepIndex]);

  return rect;
}

/** Place the popover near the target (below, flipping above when tight), or
 *  centered when there's no target. Always clamped to the viewport. */
function usePopoverPosition(rect: DOMRect | null, popH: number): { top: number; left: number } {
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, []);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const w = Math.min(POPOVER_W, vw - 16);
  const gap = 14;

  if (!rect) {
    return { top: Math.max(16, vh / 2 - popH / 2), left: Math.max(8, vw / 2 - w / 2) };
  }
  let top = rect.bottom + gap;
  if (top + popH > vh - 12) {
    const above = rect.top - gap - popH;
    top = above >= 12 ? above : Math.max(12, vh - popH - 12);
  }
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, vw - w - 8));
  return { top, left };
}

/**
 * "Take a tour" button for the section you're currently in. Renders nothing
 * when no tour matches the route, so it only shows where there's something to
 * teach.
 */
export function TourButton({ className }: { className?: string }) {
  const { start } = useTour();
  const location = useLocation();
  const tour = tourForPath(location.pathname);
  if (!tour) return null;
  return (
    <button
      onClick={() => start(tour.key)}
      aria-label="Take a tour"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink/80 shadow-sm transition hover:border-primary/40 hover:text-primary',
        className,
      )}
      title={`${tour.label} — a quick guided walkthrough`}
    >
      <Compass className="h-4 w-4" />
      <span className="hidden sm:inline">Take a tour</span>
    </button>
  );
}
