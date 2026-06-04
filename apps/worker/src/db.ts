/** D1 helpers: row encoding, generic upsert with authz + optimistic concurrency. */
import type { GenericTable } from '@sanctum/shared';
import type { Env, AuthContext } from './types.js';
import { TABLES, type TableDef } from './schema.js';
import { nowISO } from './http.js';

/** Encode a JS row into D1-storable values (JSON cols stringified, bools as int). */
export function encodeRow(def: TableDef, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of def.columns) {
    if (!(col in row)) continue;
    let v = row[col];
    if (def.jsonColumns.includes(col)) {
      v = JSON.stringify(v ?? (col === 'content' ? {} : []));
    } else if (typeof v === 'boolean') {
      v = v ? 1 : 0;
    }
    out[col] = v === undefined ? null : v;
  }
  return out;
}

/** Decode a D1 row back to JS shapes (parse JSON cols). */
export function decodeRow(def: TableDef, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const col of def.jsonColumns) {
    if (typeof row[col] === 'string') {
      try {
        out[col] = JSON.parse(row[col] as string);
      } catch {
        out[col] = col === 'content' ? {} : [];
      }
    }
  }
  return out;
}

/** Is this user the operator of the given facility? */
export async function operatesFacility(
  env: Env,
  userId: string,
  facilityId: string | null | undefined,
): Promise<boolean> {
  if (!facilityId) return false;
  const row = await env.DB.prepare('SELECT operator_id FROM facilities WHERE id = ?')
    .bind(facilityId)
    .first<{ operator_id: string }>();
  return !!row && row.operator_id === userId;
}

/**
 * Per-row authorization for generic writes.
 * Owner = you own the row (renter_id/user_id/operator_id is you) OR you operate
 * the row's facility OR you are admin.
 */
export async function canWrite(
  env: Env,
  table: GenericTable,
  row: Record<string, unknown>,
  auth: AuthContext,
): Promise<boolean> {
  if (auth.role === 'admin') return true;

  switch (table) {
    case 'profiles':
      return row.id === auth.id;
    case 'facilities':
      return row.operator_id === auth.id;
    case 'networks':
      return row.owner_id === auth.id;
    case 'notifications':
      return row.user_id === auth.id;
    case 'leads':
      // Leads are created publicly (inquiry) or by the operator; writes require operating the facility.
      return operatesFacility(env, auth.id, row.facility_id as string);
    case 'spaces':
    case 'resources':
    case 'availability_blocks':
    case 'pricing_rules':
    case 'leases':
    case 'tenant_interactions':
      return operatesFacility(env, auth.id, row.facility_id as string);
    case 'event_microsites':
      return (
        row.renter_id === auth.id ||
        operatesFacility(env, auth.id, row.facility_id as string)
      );
    case 'compliance_docs':
      return (
        row.renter_id === auth.id ||
        operatesFacility(env, auth.id, row.facility_id as string)
      );
    case 'reviews':
      return (
        row.renter_id === auth.id ||
        operatesFacility(env, auth.id, row.facility_id as string)
      );
    default:
      return false;
  }
}

export interface UpsertResult {
  ok: boolean;
  status: number;
  row?: Record<string, unknown>;
  error?: string;
}

/**
 * Conflict-safe upsert. Uses ON CONFLICT(id) DO UPDATE with partial-column
 * merge. Optimistic concurrency: if base_updated_at is provided and the stored
 * row's updated_at differs, return 409 so the client re-hydrates.
 */
export async function upsertRow(
  env: Env,
  table: GenericTable,
  input: Record<string, unknown>,
  baseUpdatedAt: string | undefined,
): Promise<UpsertResult> {
  const def = TABLES[table];
  const ts = nowISO();
  const row: Record<string, unknown> = { ...input, updated_at: ts };
  if (!row.created_at) row.created_at = ts;

  // Optimistic concurrency check against existing row.
  const existing = await env.DB.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`)
    .bind(row.id)
    .first<{ updated_at: string }>();
  if (existing && baseUpdatedAt && existing.updated_at !== baseUpdatedAt) {
    return { ok: false, status: 409, error: 'conflict' };
  }

  const encoded = encodeRow(def, row);
  const cols = Object.keys(encoded);
  const placeholders = cols.map(() => '?').join(', ');
  const updateCols = cols.filter((c) => c !== 'id' && c !== 'created_at');
  const updateClause = updateCols.map((c) => `${c} = excluded.${c}`).join(', ');

  const sql =
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updateClause}`;

  await env.DB.prepare(sql).bind(...cols.map((c) => encoded[c])).run();

  const saved = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(row.id)
    .first<Record<string, unknown>>();
  return { ok: true, status: 200, row: saved ? decodeRow(def, saved) : undefined };
}

/** Fetch all rows of a table decoded. */
export async function selectAll(
  env: Env,
  table: GenericTable,
  where?: string,
  binds: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const def = TABLES[table];
  const sql = `SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''}`;
  const res = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return (res.results || []).map((r) => decodeRow(def, r));
}
