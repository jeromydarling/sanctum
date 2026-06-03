/**
 * Auth: Worker-issued JWT (HS256 via Web Crypto) + PBKDF2 passwords.
 *
 * AUTH_SECRET resolution order:
 *   1. env.AUTH_SECRET (Worker secret), if set.
 *   2. app_secrets row 'auth_secret' in D1.
 *   3. Auto-generate, store in D1, and use it.
 * Auth is therefore never blocked on a manually-set secret.
 */
import type { Role } from '@sanctum/shared';
import type { Env, AuthContext } from './types.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 100_000;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---- base64url ----
function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
  return s;
}

// ---- AUTH_SECRET resolution ----
let cachedSecret: string | null = null;

export async function getAuthSecret(env: Env): Promise<string> {
  if (env.AUTH_SECRET && env.AUTH_SECRET.length >= 16) return env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;

  const row = await env.DB.prepare('SELECT value FROM app_secrets WHERE key = ?')
    .bind('auth_secret')
    .first<{ value: string }>();
  if (row?.value) {
    cachedSecret = row.value;
    return row.value;
  }

  const generated = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare(
    'INSERT INTO app_secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
  )
    .bind('auth_secret', generated)
    .run();
  // Re-read in case of a concurrent insert winning the race.
  const after = await env.DB.prepare('SELECT value FROM app_secrets WHERE key = ?')
    .bind('auth_secret')
    .first<{ value: string }>();
  cachedSecret = after?.value || generated;
  return cachedSecret;
}

// ---- Passwords (PBKDF2) ----
export async function hashPassword(
  password: string,
  saltB64?: string,
): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltB64
    ? b64urlDecode(saltB64)
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return { hash: toHex(bits), salt: b64urlEncode(saltBytes) };
}

export async function verifyPassword(
  password: string,
  hash: string,
  saltB64: string,
): Promise<boolean> {
  const { hash: computed } = await hashPassword(password, saltB64);
  return constantTimeEqual(computed, hash);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- JWT (HS256) ----
interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  name: string | null;
  iat: number;
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function issueToken(env: Env, user: AuthContext): Promise<string> {
  const secret = await getAuthSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64urlEncode(sig)}`;
}

export async function verifyToken(
  env: Env,
  token: string,
): Promise<AuthContext | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const secret = await getAuthSecret(env);
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sigB64) as BufferSource,
      enc.encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(payloadB64))) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      full_name: payload.name,
    };
  } catch {
    return null;
  }
}

export async function authFromRequest(
  env: Env,
  req: Request,
): Promise<AuthContext | null> {
  const header = req.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyToken(env, m[1]);
}
