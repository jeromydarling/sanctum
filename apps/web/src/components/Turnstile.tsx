/**
 * Cloudflare Turnstile widget. Renders only when a site key is configured; reports
 * { active, token } so forms can require a token when protection is on and submit
 * freely when it isn't.
 */
import { useEffect, useRef, useState } from 'react';
import { getPublicConfig } from '../lib/config.js';

interface TurnstileGlobal {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'error-callback'?: () => void; 'expired-callback'?: () => void; theme?: string }) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window { turnstile?: TurnstileGlobal; }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('turnstile script failed'));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface TurnstileState { active: boolean; token: string | null; }

export function Turnstile({ onChange }: { onChange: (s: TurnstileState) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicConfig().then((cfg) => {
      if (cancelled) return;
      if (cfg.turnstile_site_key) setSiteKey(cfg.turnstile_site_key);
      else onChange({ active: false, token: null }); // not configured -> forms submit freely
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let disposed = false;
    onChange({ active: true, token: null });
    loadScript().then(() => {
      if (disposed || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => onChange({ active: true, token }),
        'expired-callback': () => onChange({ active: true, token: null }),
        'error-callback': () => onChange({ active: true, token: null }),
      });
    }).catch(() => onChange({ active: false, token: null }));
    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) { try { window.turnstile.remove(widgetId.current); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="my-1" />;
}
