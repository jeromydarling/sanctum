/** Dedicated invoice endpoints (money — bypass generic upsert). */
import { platformFeeCents, type InvoiceLineItem } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, nowISO } from '../http.js';
import { operatesFacility } from '../db.js';
import { emitInvoicePaid } from './zapier.js';

export async function handleCreateInvoice(
  env: Env,
  req: Request,
  auth: AuthContext,
): Promise<Response> {
  const b = await readJson<{
    facility_id?: string;
    booking_id?: string;
    renter_id?: string;
    line_items?: InvoiceLineItem[];
    tax_cents?: number;
    due_date?: string;
  }>(req);

  if (!b.facility_id) return err('facility_id is required', 422);
  if (!(await operatesFacility(env, auth.id, b.facility_id)) && auth.role !== 'admin') {
    return err('Only the facility operator can create invoices', 403);
  }

  const items = Array.isArray(b.line_items) ? b.line_items : [];
  const subtotal = items.reduce((s, i) => s + Math.max(0, Math.round(i.amount_cents || 0)), 0);
  const tax = Math.max(0, Math.round(b.tax_cents || 0));
  const total = subtotal + tax;
  const fee = platformFeeCents(subtotal, parseFloat(env.PLATFORM_FEE_PERCENT || '1.5'));

  const id = genId('inv');
  const ts = nowISO();
  const number = `INV-${ts.slice(0, 10).replace(/-/g, '')}-${id.slice(-5).toUpperCase()}`;

  await env.DB.prepare(
    `INSERT INTO invoices (id, facility_id, booking_id, renter_id, invoice_number, line_items,
      subtotal_cents, tax_cents, total_cents, platform_fee_cents, status, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
  )
    .bind(id, b.facility_id, b.booking_id || null, b.renter_id || '', number,
      JSON.stringify(items), subtotal, tax, total, fee, b.due_date || null, ts, ts)
    .run();

  const saved = await getInvoice(env, id);
  return json({ ok: true, invoice: saved });
}

export async function handleInvoiceAction(
  env: Env,
  req: Request,
  auth: AuthContext,
  id: string,
  action: 'send' | 'paid' | 'void',
): Promise<Response> {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!inv) return err('Invoice not found', 404);
  const allowed = (await operatesFacility(env, auth.id, inv.facility_id as string)) || auth.role === 'admin';
  if (!allowed) return err('Not permitted', 403);

  const b = await readJson<{ base_updated_at?: string }>(req);
  if (b.base_updated_at && inv.updated_at !== b.base_updated_at) {
    return err('Invoice changed since you loaded it.', 409, { conflict: true });
  }

  const status = action === 'send' ? 'sent' : action === 'paid' ? 'paid' : 'void';
  const paidAt = action === 'paid' ? nowISO() : (inv.paid_at as string | null);
  await env.DB.prepare('UPDATE invoices SET status = ?, paid_at = ?, updated_at = ? WHERE id = ?')
    .bind(status, paidAt, nowISO(), id)
    .run();
  // On a paid standalone (tenant) invoice, push to the operator's Zapier hook.
  if (action === 'paid') await emitInvoicePaid(env, { ...inv, status, paid_at: paidAt });
  return json({ ok: true, invoice: await getInvoice(env, id) });
}

async function getInvoice(env: Env, id: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  try { row.line_items = JSON.parse((row.line_items as string) || '[]'); } catch { row.line_items = []; }
  return row;
}
