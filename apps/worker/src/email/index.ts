/**
 * Transactional email via Cloudflare Email Service (env.EMAIL.send).
 * 100% Cloudflare — no third-party provider. No-op (logs only) until the
 * Email Sending binding is enabled, so nothing breaks when unconfigured.
 */
import type { Env } from '../types.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(env: Env, msg: EmailMessage): Promise<{ sent: boolean; demo?: boolean }> {
  const from = env.EMAIL_FROM || 'Sanctum <hello@sanctum.garden>';
  const result = await deliver(env, msg, from);
  // Record every outbound email (metadata only) so the pipeline is observable
  // and testable — best-effort, never let logging break a send.
  try {
    await env.DB.prepare('INSERT INTO email_log (id, to_addr, subject, sent) VALUES (?, ?, ?, ?)')
      .bind(`eml-${crypto.randomUUID()}`, msg.to.toLowerCase(), msg.subject, result.sent ? 1 : 0).run();
  } catch (e) {
    console.error('[email:log]', e);
  }
  return result;
}

async function deliver(env: Env, msg: EmailMessage, from: string): Promise<{ sent: boolean; demo?: boolean }> {
  if (!env.EMAIL) {
    console.log(`[email:noop] to=${msg.to} subject="${msg.subject}"`);
    return { sent: false, demo: true };
  }
  try {
    await env.EMAIL.send({
      to: msg.to,
      from,
      subject: msg.subject,
      html: msg.html,
      text: msg.text || stripHtml(msg.html),
      // Route replies to a real inbox (the from-address is send-only).
      ...(env.EMAIL_REPLY_TO ? { headers: { 'Reply-To': env.EMAIL_REPLY_TO } } : {}),
    });
    return { sent: true };
  } catch (e) {
    console.error('[email:exception]', e);
    return { sent: false };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Branded email wrapper. */
export function emailLayout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const ctaHtml = cta
    ? `<a href="${cta.url}" style="display:inline-block;background:#4338ca;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">${cta.label}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Inter,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#4338ca;margin-bottom:24px">Sanctum</div>
    <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px">${heading}</h1>
      <div style="font-size:15px;line-height:1.6;color:#3a3a3a">${bodyHtml}</div>
      ${ctaHtml}
    </div>
    <p style="font-size:12px;color:#8b8680;text-align:center;margin-top:24px">Open doors. Stronger communities.</p>
  </div></body></html>`;
}
