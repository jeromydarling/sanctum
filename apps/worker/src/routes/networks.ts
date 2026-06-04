/** Self-serve network invitations (a diocese invites a parish to its network). */
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { sendEmail, emailLayout } from '../email/index.js';

async function ownsNetwork(env: Env, userId: string, networkId: string): Promise<{ id: string; name: string } | null> {
  const n = await env.DB.prepare('SELECT id, name FROM networks WHERE id = ? AND owner_id = ?')
    .bind(networkId, userId).first<{ id: string; name: string }>();
  return n || null;
}

/** POST /api/networks/invite { network_id, email } */
export async function handleNetworkInvite(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { network_id, email } = await readJson<{ network_id?: string; email?: string }>(req);
  if (!network_id || !email?.trim()) return err('network_id and email are required', 422);
  const network = await ownsNetwork(env, auth.id, network_id);
  if (!network && auth.role !== 'admin') return err('Only the network owner can invite communities', 403);
  const networkName = network?.name || 'a Sanctum network';

  const inviteEmail = email.trim().toLowerCase();
  const token = `${genId('inv')}.${crypto.randomUUID()}`;
  await env.DB.prepare('INSERT INTO network_invites (token, network_id, email) VALUES (?, ?, ?)')
    .bind(token, network_id, inviteEmail).run();

  const link = `${env.APP_URL || ''}/operator/network?invite=${encodeURIComponent(token)}`;

  // In-app notification if the invitee already has an account.
  const profile = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(inviteEmail).first<{ id: string }>();
  if (profile) {
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, is_read, action_url, created_at, updated_at)
       VALUES (?, ?, 'Network invitation', ?, 'network', 0, ?, ?, ?)`,
    ).bind(genId('ntf'), profile.id, `You're invited to join ${networkName}.`, link, nowISO(), nowISO()).run();
  }

  await sendEmail(env, {
    to: inviteEmail,
    subject: `You're invited to join ${networkName} on Sanctum`,
    html: emailLayout(
      `Join ${escapeHtml(networkName)}`,
      `<p>You've been invited to add your community to <strong>${escapeHtml(networkName)}</strong> on Sanctum — a shared, branded home for your network's spaces.</p>`,
      { label: 'Review the invitation', url: link },
    ),
  });

  return json({ ok: true });
}

/** GET /api/networks/invite-info?token= -> { network_name } */
export async function handleInviteInfo(env: Env, url: URL, auth: AuthContext): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  const invite = await env.DB.prepare('SELECT network_id, email, accepted_at FROM network_invites WHERE token = ?')
    .bind(token).first<{ network_id: string; email: string; accepted_at: string | null }>();
  if (!invite) return err('This invitation is invalid or has expired', 404);
  if (invite.accepted_at) return err('This invitation has already been used', 410);
  if (invite.email !== auth.email.toLowerCase()) return err('This invitation was sent to a different email', 403);
  const network = await env.DB.prepare('SELECT name, slug FROM networks WHERE id = ?').bind(invite.network_id).first<{ name: string; slug: string }>();
  return json({ network_name: network?.name || 'a network', network_id: invite.network_id });
}

/** POST /api/networks/accept { token, facility_id } */
export async function handleNetworkAccept(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { token, facility_id } = await readJson<{ token?: string; facility_id?: string }>(req);
  if (!token || !facility_id) return err('token and facility_id are required', 422);

  const invite = await env.DB.prepare('SELECT network_id, email, accepted_at FROM network_invites WHERE token = ?')
    .bind(token).first<{ network_id: string; email: string; accepted_at: string | null }>();
  if (!invite) return err('This invitation is invalid', 404);
  if (invite.accepted_at) return err('This invitation has already been used', 410);
  if (invite.email !== auth.email.toLowerCase()) return err('This invitation was sent to a different email', 403);

  const facility = await env.DB.prepare('SELECT id, operator_id FROM facilities WHERE id = ?').bind(facility_id).first<{ id: string; operator_id: string }>();
  if (!facility || facility.operator_id !== auth.id) return err('That community is not yours', 403);

  const ts = nowISO();
  await env.DB.batch([
    env.DB.prepare('UPDATE facilities SET network_id = ?, updated_at = ? WHERE id = ?').bind(invite.network_id, ts, facility_id),
    env.DB.prepare('UPDATE network_invites SET accepted_at = ? WHERE token = ?').bind(ts, token),
  ]);
  return json({ ok: true, network_id: invite.network_id });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** POST /api/networks/join { network_id, facility_id } — owner adds a community they operate. */
export async function handleNetworkJoin(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { network_id, facility_id } = await readJson<{ network_id?: string; facility_id?: string }>(req);
  if (!network_id || !facility_id) return err('network_id and facility_id are required', 422);
  const owns = await ownsNetwork(env, auth.id, network_id);
  if (!owns && auth.role !== 'admin') return err('Only the network owner can add communities', 403);
  const facility = await env.DB.prepare('SELECT operator_id FROM facilities WHERE id = ?').bind(facility_id).first<{ operator_id: string }>();
  if (!facility) return err('Facility not found', 404);
  if (facility.operator_id !== auth.id && auth.role !== 'admin') return err('That community is not yours', 403);
  await env.DB.prepare('UPDATE facilities SET network_id = ?, updated_at = ? WHERE id = ?').bind(network_id, nowISO(), facility_id).run();
  return json({ ok: true });
}

/** POST /api/networks/leave { facility_id } — remove a community from its network. */
export async function handleNetworkLeave(env: Env, req: Request, auth: AuthContext): Promise<Response> {
  const { facility_id } = await readJson<{ facility_id?: string }>(req);
  if (!facility_id) return err('facility_id is required', 422);
  const facility = await env.DB.prepare('SELECT operator_id FROM facilities WHERE id = ?').bind(facility_id).first<{ operator_id: string }>();
  if (!facility) return err('Facility not found', 404);
  if (facility.operator_id !== auth.id && auth.role !== 'admin') return err('That community is not yours', 403);
  await env.DB.prepare('UPDATE facilities SET network_id = NULL, updated_at = ? WHERE id = ?').bind(nowISO(), facility_id).run();
  return json({ ok: true });
}
