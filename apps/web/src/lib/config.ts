/**
 * Runtime session mode. Demo (one-click role login) = in-memory sandbox that
 * resets on reload and never persists. Live (signup / email login) = D1-backed,
 * write-through enabled. The mode is decided by the auth method.
 */

const TOKEN_KEY = 'sanctum.token';
const MODE_KEY = 'sanctum.mode';

export type SessionMode = 'demo' | 'live' | null;

let mode: SessionMode = (sessionStorage.getItem(MODE_KEY) as SessionMode) || null;

export function getSessionMode(): SessionMode {
  return mode;
}

export function setSessionMode(m: Exclude<SessionMode, null>): void {
  mode = m;
  sessionStorage.setItem(MODE_KEY, m);
}

export function clearSessionMode(): void {
  mode = null;
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isLive(): boolean {
  return mode === 'live';
}

export function isDemo(): boolean {
  return mode === 'demo';
}

// Live tokens persist (localStorage) so a refresh keeps you signed in.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const SUPPORT_EMAIL = 'help@sanctum.app';

// Public runtime config (Turnstile site key, etc.), fetched once and cached.
let configPromise: Promise<{ turnstile_site_key: string | null }> | null = null;
export function getPublicConfig(): Promise<{ turnstile_site_key: string | null }> {
  if (!configPromise) {
    configPromise = fetch('/api/config')
      .then((r) => (r.ok ? r.json() : { turnstile_site_key: null }))
      .catch(() => ({ turnstile_site_key: null }));
  }
  return configPromise;
}
