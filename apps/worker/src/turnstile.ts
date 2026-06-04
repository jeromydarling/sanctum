/** Cloudflare Turnstile verification. Degrades to "pass" when not configured. */
import type { Env } from './types.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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
