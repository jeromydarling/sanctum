/**
 * Coarse fixed-window rate limiting backed by D1 (no extra bindings, so it can
 * never break a deploy). Complements Turnstile: blunts credential-stuffing and
 * signup/inquiry spam. Fails OPEN — if the check errors, the request proceeds,
 * so a limiter hiccup never locks legitimate users out.
 */
import type { Env } from './types.js';

/** Returns true if this (action, ip) has exceeded `limit` within `windowSec`. */
export async function rateLimited(
  env: Env,
  action: string,
  ip: string,
  limit = 12,
  windowSec = 60,
): Promise<boolean> {
  if (!ip || ip === 'unknown') return false; // can't attribute — don't block
  const now = Math.floor(Date.now() / 1000);
  const windowIndex = Math.floor(now / windowSec);
  const bucket = `${action}:${ip}:${windowIndex}`;
  try {
    await env.DB.prepare(
      'INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1',
    ).bind(bucket, now).run();
    const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE bucket = ?').bind(bucket).first<{ count: number }>();
    return (row?.count || 0) > limit;
  } catch {
    return false; // fail open
  }
}

/** Prune expired rate-limit rows (called from the daily cron). */
export async function pruneRateLimits(env: Env): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600;
  try {
    await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(cutoff).run();
  } catch { /* best-effort */ }
}
