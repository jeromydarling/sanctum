/** Cloudflare Turnstile verification. Degrades to "pass" when not configured. */
import type { Env } from './types.js';
import { clientIP } from './http.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * True when this is a trusted end-to-end test request allowed to skip Turnstile:
 * it carries the E2E guard token AND targets a throwaway `e2e+` address. This is
 * the same trust model already used for account purge and payment simulation —
 * it never bypasses for a real (non-`e2e+`) user, and the guard token should be
 * set as a Worker secret (E2E_ADMIN_TOKEN) in production.
 */
export function e2eBypass(env: Env, req: Request, email?: string): boolean {
  const token = req.headers.get('x-e2e-token') || '';
  const expected = env.E2E_ADMIN_TOKEN || 'sanctum-e2e-purge';
  if (token !== expected) return false;
  const e = (email || '').trim().toLowerCase();
  return e !== '' && /^e2e\+/i.test(e);
}

/** Turnstile check with the E2E bypass folded in — use this from request handlers. */
export async function turnstileOk(
  env: Env,
  req: Request,
  token: string | undefined,
  email?: string,
): Promise<boolean> {
  if (e2eBypass(env, req, email)) return true;
  return verifyTurnstile(env, token, clientIP(req));
}

export async function verifyTurnstile(env: Env, token: string | undefined, ip: string): Promise<boolean> {
  // Not configured -> don't block (forms work before keys are set).
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (ip && ip !== 'unknown') form.set('remoteip', ip);
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
