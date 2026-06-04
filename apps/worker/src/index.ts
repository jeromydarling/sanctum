/**
 * Sanctum unified Worker. Serves the SPA static assets (via the assets binding)
 * and all /api/* routes. The whole fetch is wrapped in try/catch returning a
 * friendly error + incident id.
 */
import type { Env, AuthContext } from './types.js';
import { json, err, genId, nowISO } from './http.js';
import { authFromRequest } from './auth.js';
import { handleSignup, handleLogin, handleMe, handleForgotPassword, handleResetPassword } from './routes/auth.js';
import { handleUpsert, handleDelete, handleHydrate } from './routes/data.js';
import { handleCreateBooking, handleBookingStatus } from './routes/bookings.js';
import { handleCreateInvoice, handleInvoiceAction } from './routes/invoices.js';
import { handleDiscover, handleFacilityBySlug, handleEventBySlug, handleInquiry, handleNetworkBySlug } from './routes/public.js';
import { handleAITool, handleAIImage, handleOnboard } from './routes/ai.js';
import { handleUpload, handleFileServe } from './routes/files.js';
import { handleTelemetry, handleExport, handleDeleteAccount } from './routes/misc.js';
import { handleConnectAccount, handleCheckout, handleWebhook, handleSubscribe, handleBillingPortal, handleDepositResolve } from './routes/stripe.js';
import { handleAdminErrors, handleAdminAnnounce } from './routes/admin.js';
import { handleNetworkInvite, handleInviteInfo, handleNetworkAccept, handleNetworkJoin, handleNetworkLeave } from './routes/networks.js';
import { handleQboConnect, handleQboCallback, handleQboStatus, handleQboDisconnect, handleQboSync } from './routes/qbo.js';
import { handleIcalExport, handleSubscribeUrl, handleIcalImport } from './routes/ical.js';
import { runScheduled } from './scheduled.js';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      // Static assets handled by the assets binding (run_worker_first only routes /api/*).
      return new Response('Not found', { status: 404 });
    }
    try {
      return await route(req, env, url, ctx);
    } catch (e) {
      const incidentId = genId('inc');
      console.error(`[worker-error] ${incidentId}`, e);
      try {
        await env.DB.prepare(
          `INSERT INTO error_logs (id, incident_id, source, message, stack, url, created_at)
           VALUES (?, ?, 'worker', ?, ?, ?, ?)`,
        ).bind(genId('err'), incidentId, String((e as Error)?.message || e).slice(0, 2000), String((e as Error)?.stack || '').slice(0, 4000), url.pathname, nowISO()).run();
      } catch { /* swallow logging errors */ }
      return json(
        { error: 'Something went wrong on our end. Our team has been notified.', incident_id: incidentId },
        500,
      );
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env));
  },
};

async function route(req: Request, env: Env, url: URL, _ctx: ExecutionContext): Promise<Response> {
  const path = url.pathname;
  const method = req.method;
  const seg = path.replace(/^\/api\//, '').split('/').filter(Boolean);

  // CORS preflight (same-origin in prod, but harmless).
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  // ---- Public (no auth) ----
  if (path === '/api/health') return json({ ok: true, ts: nowISO() });
  if (path === '/api/auth/signup' && method === 'POST') return handleSignup(env, req);
  if (path === '/api/auth/login' && method === 'POST') return handleLogin(env, req);
  if (path === '/api/auth/forgot' && method === 'POST') return handleForgotPassword(env, req);
  if (path === '/api/auth/reset' && method === 'POST') return handleResetPassword(env, req);
  if (path === '/api/public/discover' && method === 'GET') return handleDiscover(env, url);
  if (path === '/api/public/inquiry' && method === 'POST') return handleInquiry(env, req);
  if (seg[0] === 'public' && seg[1] === 'facility' && seg[2] && method === 'GET') {
    return handleFacilityBySlug(env, decodeURIComponent(seg.slice(2).join('/')));
  }
  if (seg[0] === 'public' && seg[1] === 'event' && seg[2] && method === 'GET') {
    return handleEventBySlug(env, decodeURIComponent(seg[2]));
  }
  if (seg[0] === 'public' && seg[1] === 'network' && seg[2] && method === 'GET') {
    return handleNetworkBySlug(env, decodeURIComponent(seg[2]));
  }
  if (path === '/api/telemetry/error' && method === 'POST') return handleTelemetry(env, req);
  if (path === '/api/stripe/webhooks' && method === 'POST') return handleWebhook(env, req);
  if (path === '/api/qbo/callback' && method === 'GET') return handleQboCallback(env, url);

  // File serving is public (keys are unguessable).
  if (seg[0] === 'files' && method === 'GET') {
    return handleFileServe(env, decodeURIComponent(seg.slice(1).join('/')), url);
  }

  // Outbound iCal feed is public (token-gated, in the path).
  if (seg[0] === 'ical' && seg[1]?.endsWith('.ics') && method === 'GET') {
    return handleIcalExport(env, decodeURIComponent(seg[1].replace(/\.ics$/, '')));
  }

  // AI tools may be used by anonymous prospects (IP-metered).
  const auth = await authFromRequest(env, req);
  if (seg[0] === 'ai' && method === 'POST') {
    if (seg[1] === 'image') return handleAIImage(env, req, auth);
    if (seg[1] === 'onboard') return handleOnboard(env, req, auth);
    return handleAITool(env, req, auth, seg.slice(1).join('/'));
  }

  // ---- Authenticated ----
  if (!auth) return err('Please sign in to continue', 401);

  if (path === '/api/auth/me' && method === 'GET') return handleMe(auth);
  if (path === '/api/data/hydrate' && method === 'GET') return handleHydrate(env, auth);
  if (path === '/api/data/upsert' && method === 'POST') return handleUpsert(env, req, auth);
  if (path === '/api/data/delete' && method === 'POST') return handleDelete(env, req, auth);

  if (path === '/api/upload' && method === 'POST') return handleUpload(env, req, auth);

  // Calendar sync
  if (path === '/api/ical/subscribe-url' && method === 'GET') return handleSubscribeUrl(env, url, auth);
  if (path === '/api/ical/import' && method === 'POST') return handleIcalImport(env, req, auth);

  if (path === '/api/account/export' && method === 'GET') return handleExport(env, auth);
  if (path === '/api/account/delete' && method === 'POST') return handleDeleteAccount(env, auth);

  // Bookings (dedicated)
  if (path === '/api/bookings' && method === 'POST') return handleCreateBooking(env, req, auth);
  if (seg[0] === 'bookings' && seg[1] && seg[2] === 'deposit' && method === 'POST') {
    return handleDepositResolve(env, req, auth, seg[1]);
  }
  if (seg[0] === 'bookings' && seg[1] && seg[2] && method === 'POST') {
    const action = seg[2] as 'approve' | 'deny' | 'cancel' | 'confirm' | 'complete';
    if (['approve', 'deny', 'cancel', 'confirm', 'complete'].includes(action)) {
      return handleBookingStatus(env, req, auth, seg[1], action);
    }
  }

  // Invoices (dedicated)
  if (path === '/api/invoices' && method === 'POST') return handleCreateInvoice(env, req, auth);
  if (seg[0] === 'invoices' && seg[1] && seg[2] && method === 'POST') {
    const action = seg[2] as 'send' | 'paid' | 'void';
    if (['send', 'paid', 'void'].includes(action)) {
      return handleInvoiceAction(env, req, auth, seg[1], action);
    }
  }

  // Networks (self-serve invitations)
  if (path === '/api/networks/invite' && method === 'POST') return handleNetworkInvite(env, req, auth);
  if (path === '/api/networks/invite-info' && method === 'GET') return handleInviteInfo(env, url, auth);
  if (path === '/api/networks/accept' && method === 'POST') return handleNetworkAccept(env, req, auth);
  if (path === '/api/networks/join' && method === 'POST') return handleNetworkJoin(env, req, auth);
  if (path === '/api/networks/leave' && method === 'POST') return handleNetworkLeave(env, req, auth);

  // Admin
  if (path === '/api/admin/errors' && method === 'GET') return handleAdminErrors(env, auth);
  if (path === '/api/admin/announce' && method === 'POST') return handleAdminAnnounce(env, req, auth);

  // Stripe (authenticated)
  if (path === '/api/stripe/connect/create-account' && method === 'POST') return handleConnectAccount(env, req, auth);
  if (path === '/api/stripe/checkout' && method === 'POST') return handleCheckout(env, req, auth);
  if (path === '/api/stripe/subscribe' && method === 'POST') return handleSubscribe(env, req, auth);
  if (path === '/api/stripe/portal' && method === 'POST') return handleBillingPortal(env, req, auth);

  // QuickBooks Online
  if (path === '/api/qbo/connect' && method === 'GET') return handleQboConnect(env, url, auth);
  if (path === '/api/qbo/status' && method === 'GET') return handleQboStatus(env, url, auth);
  if (path === '/api/qbo/disconnect' && method === 'POST') return handleQboDisconnect(env, req, auth);
  if (path === '/api/qbo/sync' && method === 'POST') return handleQboSync(env, req, auth);

  return err('Not found', 404);
}

export type { AuthContext };
