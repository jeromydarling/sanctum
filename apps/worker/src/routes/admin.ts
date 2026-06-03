/** Admin-only endpoints. */
import type { Env, AuthContext } from '../types.js';
import { json, err } from '../http.js';

export async function handleAdminErrors(env: Env, auth: AuthContext): Promise<Response> {
  if (auth.role !== 'admin') return err('Admins only', 403);
  const res = await env.DB.prepare(
    'SELECT id, incident_id, source, message, url, created_at FROM error_logs ORDER BY created_at DESC LIMIT 100',
  ).all<Record<string, unknown>>();
  return json({ errors: res.results || [] });
}
