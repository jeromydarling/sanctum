/** Auth routes: signup, login, me. Live D1-backed. */
import { slugify, starterFacilityId, type Role } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { hashPassword, verifyPassword, issueToken } from '../auth.js';
import { sendEmail, emailLayout } from '../email/index.js';

interface SignupBody {
  email?: string;
  password?: string;
  full_name?: string;
  role?: Role;
  organization_name?: string;
}

const VALID_ROLES: Role[] = ['operator', 'renter'];

export async function handleSignup(env: Env, req: Request): Promise<Response> {
  const body = await readJson<SignupBody>(req);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const role: Role = VALID_ROLES.includes(body.role as Role) ? (body.role as Role) : 'renter';

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return err('A valid email is required', 422);
  if (password.length < 8) return err('Password must be at least 8 characters', 422);

  const existing = await env.DB.prepare('SELECT user_id FROM auth_credentials WHERE email = ?')
    .bind(email)
    .first<{ user_id: string }>();
  if (existing) return err('An account with this email already exists', 409);

  const userId = genId('usr');
  const ts = nowISO();
  const { hash, salt } = await hashPassword(password);

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO auth_credentials (user_id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)',
    ).bind(userId, email, hash, salt),
    env.DB.prepare(
      'INSERT INTO profiles (id, email, full_name, role, organization_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(userId, email, body.full_name || null, role, body.organization_name || null, ts, ts),
  ]);

  // Provision a deterministic starter facility for operators so the dashboard
  // is never empty (deterministic id avoids duplicate provisioning).
  if (role === 'operator') {
    const facId = starterFacilityId(userId);
    const baseName = body.organization_name || body.full_name || 'Your Community';
    const slug = `${slugify(baseName)}-${userId.slice(-6)}`;
    // Auto-approve by default: a booking goes straight to payment, no review gate.
    await env.DB.prepare(
      `INSERT INTO facilities (id, operator_id, name, slug, requires_approval, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING`,
    )
      .bind(facId, userId, baseName, slug, ts, ts)
      .run();
  }

  // Warm welcome email (best-effort).
  await sendEmail(env, {
    to: email,
    subject: 'Welcome to Sanctum',
    html: emailLayout(
      'Welcome to Sanctum 🕊️',
      role === 'operator'
        ? `<p>Thank you for opening your doors. Your community space is set up and ready — add your spaces, set your rates, and connect payouts whenever you're ready.</p><p>Open doors. Stronger communities.</p>`
        : `<p>Welcome! You can now discover welcoming community spaces and book the perfect place for your next gathering.</p>`,
      { label: 'Go to your dashboard', url: `${env.APP_URL || ''}${role === 'operator' ? '/operator' : '/renter'}` },
    ),
  });

  const user: AuthContext = { id: userId, email, role, full_name: body.full_name || null };
  const token = await issueToken(env, user);
  return json({ token, user: { id: userId, email, role, full_name: body.full_name || null } });
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** POST /api/auth/forgot { email } — always returns ok (no account enumeration). */
export async function handleForgotPassword(env: Env, req: Request): Promise<Response> {
  const { email } = await readJson<{ email?: string }>(req);
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return err('Email is required', 422);

  const cred = await env.DB.prepare('SELECT user_id FROM auth_credentials WHERE email = ?')
    .bind(clean).first<{ user_id: string }>();
  if (cred) {
    const rawToken = `${genId('rst')}.${crypto.randomUUID()}`;
    const tokenHash = await sha256hex(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await env.DB.prepare(
      'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).bind(tokenHash, cred.user_id, expires).run();

    const link = `${env.APP_URL || ''}/reset?token=${encodeURIComponent(rawToken)}`;
    await sendEmail(env, {
      to: clean,
      subject: 'Reset your Sanctum password',
      html: emailLayout(
        'Reset your password',
        `<p>We received a request to reset your Sanctum password. This link is valid for one hour.</p><p>If you didn't ask for this, you can safely ignore this email.</p>`,
        { label: 'Choose a new password', url: link },
      ),
    });
  }
  return json({ ok: true });
}

/** POST /api/auth/reset { token, password } */
export async function handleResetPassword(env: Env, req: Request): Promise<Response> {
  const { token, password } = await readJson<{ token?: string; password?: string }>(req);
  if (!token || !password) return err('Token and new password are required', 422);
  if (password.length < 8) return err('Password must be at least 8 characters', 422);

  const tokenHash = await sha256hex(token);
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?')
    .bind(tokenHash).first<{ user_id: string; expires_at: string }>();
  if (!row) return err('This reset link is invalid or has already been used.', 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM password_resets WHERE token_hash = ?').bind(tokenHash).run();
    return err('This reset link has expired. Please request a new one.', 400);
  }

  const { hash, salt } = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare('UPDATE auth_credentials SET password_hash = ?, password_salt = ? WHERE user_id = ?')
      .bind(hash, salt, row.user_id),
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(row.user_id),
  ]);
  return json({ ok: true });
}

export async function handleLogin(env: Env, req: Request): Promise<Response> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return err('Email and password are required', 422);

  const cred = await env.DB.prepare(
    'SELECT user_id, password_hash, password_salt FROM auth_credentials WHERE email = ?',
  )
    .bind(email)
    .first<{ user_id: string; password_hash: string; password_salt: string }>();
  if (!cred) return err('Invalid email or password', 401);

  const ok = await verifyPassword(password, cred.password_hash, cred.password_salt);
  if (!ok) return err('Invalid email or password', 401);

  const profile = await env.DB.prepare(
    'SELECT id, email, role, full_name FROM profiles WHERE id = ?',
  )
    .bind(cred.user_id)
    .first<AuthContext>();
  if (!profile) return err('Account not found', 404);

  const token = await issueToken(env, profile);
  return json({ token, user: profile });
}

export async function handleMe(auth: AuthContext | null): Promise<Response> {
  if (!auth) return err('Not authenticated', 401);
  return json({ user: auth });
}
