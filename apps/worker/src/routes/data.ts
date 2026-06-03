/** Generic write-through upsert/delete + scoped hydrate. */
import type { GenericTable } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson } from '../http.js';
import { isGenericTable } from '../schema.js';
import { canWrite, upsertRow, selectAll, operatesFacility } from '../db.js';

interface UpsertBody {
  table?: string;
  row?: Record<string, unknown>;
  base_updated_at?: string;
}

export async function handleUpsert(
  env: Env,
  req: Request,
  auth: AuthContext,
): Promise<Response> {
  const body = await readJson<UpsertBody>(req);
  const table = body.table || '';
  const row = body.row;
  if (!isGenericTable(table)) return err(`Table "${table}" is not writable here`, 400);
  if (!row || typeof row !== 'object' || !row.id) return err('A row with an id is required', 422);

  const allowed = await canWrite(env, table, row, auth);
  if (!allowed) return err('You do not have permission to write this record', 403);

  const result = await upsertRow(env, table as GenericTable, row, body.base_updated_at);
  if (result.status === 409) {
    return err('This record changed since you loaded it. Refreshing…', 409, { conflict: true });
  }
  if (!result.ok) return err(result.error || 'Write failed', 400);
  return json({ ok: true, row: result.row });
}

export async function handleDelete(
  env: Env,
  req: Request,
  auth: AuthContext,
): Promise<Response> {
  const body = await readJson<{ table?: string; id?: string }>(req);
  const table = body.table || '';
  const id = body.id || '';
  if (!isGenericTable(table)) return err(`Table "${table}" is not deletable here`, 400);
  if (!id) return err('An id is required', 422);

  const existing = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!existing) return json({ ok: true }); // already gone

  const allowed = await canWrite(env, table as GenericTable, existing, auth);
  if (!allowed) return err('You do not have permission to delete this record', 403);

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

/**
 * Hydrate the in-memory store with data scoped to the caller. Never dumps all
 * profiles/PII. Public directory data is served separately via /api/public/*.
 */
export async function handleHydrate(env: Env, auth: AuthContext): Promise<Response> {
  const out: Record<string, unknown[]> = {
    profiles: [],
    facilities: [],
    spaces: [],
    resources: [],
    bookings: [],
    compliance_docs: [],
    invoices: [],
    reviews: [],
    leads: [],
    notifications: [],
    event_microsites: [],
    availability_blocks: [],
  };

  // Own profile + notifications always.
  out.profiles = await selectAll(env, 'profiles', 'id = ?', [auth.id]);
  out.notifications = await selectAll(env, 'notifications', 'user_id = ?', [auth.id]);

  if (auth.role === 'admin') {
    for (const t of ['facilities', 'spaces', 'resources', 'reviews', 'leads', 'event_microsites'] as GenericTable[]) {
      out[t] = await selectAll(env, t);
    }
    out.bookings = await raw(env, 'bookings');
    out.invoices = await raw(env, 'invoices');
    out.compliance_docs = await selectAll(env, 'compliance_docs');
    return json(out);
  }

  if (auth.role === 'operator' || auth.role === 'staff') {
    const facilities = await selectAll(env, 'facilities', 'operator_id = ?', [auth.id]);
    out.facilities = facilities;
    const facIds = facilities.map((f) => f.id as string);
    if (facIds.length) {
      const ph = facIds.map(() => '?').join(',');
      out.spaces = await selectAll(env, 'spaces', `facility_id IN (${ph})`, facIds);
      out.resources = await selectAll(env, 'resources', `facility_id IN (${ph})`, facIds);
      out.reviews = await selectAll(env, 'reviews', `facility_id IN (${ph})`, facIds);
      out.leads = await selectAll(env, 'leads', `facility_id IN (${ph})`, facIds);
      out.compliance_docs = await selectAll(env, 'compliance_docs', `facility_id IN (${ph})`, facIds);
      out.event_microsites = await selectAll(env, 'event_microsites', `facility_id IN (${ph})`, facIds);
      out.availability_blocks = await selectAll(env, 'availability_blocks', `facility_id IN (${ph})`, facIds);
      out.bookings = await raw(env, 'bookings', `facility_id IN (${ph})`, facIds);
      out.invoices = await raw(env, 'invoices', `facility_id IN (${ph})`, facIds);
    }
    return json(out);
  }

  // Renter: own bookings, docs, reviews, microsites + referenced facilities/spaces.
  out.bookings = await raw(env, 'bookings', 'renter_id = ?', [auth.id]);
  out.compliance_docs = await selectAll(env, 'compliance_docs', 'renter_id = ?', [auth.id]);
  out.invoices = await raw(env, 'invoices', 'renter_id = ?', [auth.id]);
  out.reviews = await selectAll(env, 'reviews', 'renter_id = ?', [auth.id]);
  out.event_microsites = await selectAll(env, 'event_microsites', 'renter_id = ?', [auth.id]);

  const facIds = unique(out.bookings.map((b) => (b as Record<string, unknown>).facility_id as string));
  const spaceIds = unique(out.bookings.map((b) => (b as Record<string, unknown>).space_id as string));
  if (facIds.length) {
    const ph = facIds.map(() => '?').join(',');
    out.facilities = await selectAll(env, 'facilities', `id IN (${ph})`, facIds);
  }
  if (spaceIds.length) {
    const ph = spaceIds.map(() => '?').join(',');
    out.spaces = await selectAll(env, 'spaces', `id IN (${ph})`, spaceIds);
  }
  return json(out);
}

// bookings/invoices are not in the generic registry; read them raw with JSON parse.
async function raw(
  env: Env,
  table: 'bookings' | 'invoices',
  where?: string,
  binds: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const sql = `SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''}`;
  const res = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  const jsonCols = table === 'bookings' ? ['resource_ids'] : ['line_items'];
  return (res.results || []).map((r) => {
    const out = { ...r };
    for (const c of jsonCols) {
      if (typeof r[c] === 'string') {
        try { out[c] = JSON.parse(r[c] as string); } catch { out[c] = []; }
      }
    }
    return out;
  });
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

export { operatesFacility };
