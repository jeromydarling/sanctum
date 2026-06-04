/**
 * SpaceLock — a Durable Object that serializes booking writes for a single space,
 * closing the check-then-insert race that a plain SELECT+INSERT can't (two
 * simultaneous requests for the same slot could both pass the conflict check).
 *
 * Addressed by space_id (idFromName), so all creates for a given space run one at
 * a time. The conflict check + insert happen inside blockConcurrencyWhile, which
 * blocks any other event on this instance until it completes — atomic per space.
 */
import type { Env } from './types.js';

const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed'];

interface LockRequest {
  columns: Record<string, unknown>;
  bufferMinutes: number;
}

export class SpaceLock implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const { columns, bufferMinutes } = (await req.json()) as LockRequest;
    // Serialize: nothing else runs on this DO instance until this resolves.
    return this.state.blockConcurrencyWhile(async () => {
      const spaceId = String(columns.space_id);
      const start = String(columns.start_time);
      const end = String(columns.end_time);
      const buf = Number(bufferMinutes) || 0;
      const bufStart = new Date(new Date(start).getTime() - buf * 60000).toISOString();
      const bufEnd = new Date(new Date(end).getTime() + buf * 60000).toISOString();

      const ph = ACTIVE_STATUSES.map(() => '?').join(',');
      const conflict = await this.env.DB.prepare(
        `SELECT id FROM bookings WHERE space_id = ? AND status IN (${ph}) AND start_time < ? AND end_time > ?`,
      ).bind(spaceId, ...ACTIVE_STATUSES, bufEnd, bufStart).first();
      if (conflict) {
        return Response.json({ conflict: true });
      }

      const cols = Object.keys(columns);
      const sql = `INSERT INTO bookings (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      await this.env.DB.prepare(sql).bind(...cols.map((c) => columns[c])).run();
      return Response.json({ ok: true });
    });
  }
}

/** Atomically conflict-check + insert a booking via the per-space lock. */
export async function insertBookingViaLock(
  env: Env,
  columns: Record<string, unknown>,
  bufferMinutes: number,
): Promise<{ ok: boolean; conflict?: boolean }> {
  const id = env.SPACE_LOCK.idFromName(String(columns.space_id));
  const stub = env.SPACE_LOCK.get(id);
  const res = await stub.fetch('https://lock/insert', {
    method: 'POST',
    body: JSON.stringify({ columns, bufferMinutes }),
  });
  return res.json();
}
