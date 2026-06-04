import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Printer, FileSpreadsheet, RefreshCw, Link2, Check } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat, Select, Button, EmptyState, Badge } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName, renterName } from '../../lib/selectors.js';
import { api } from '../../lib/api.js';
import { isLive } from '../../lib/config.js';
import { notifyError } from '../../lib/errors.js';
import { formatCents } from '../../lib/format.js';

interface Txn { date: string; type: string; customer: string; description: string; gross: number; fee: number; net: number; status: string; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Financials() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [year, setYear] = useState(new Date().getFullYear());

  const txns = useMemo<Txn[]>(() => {
    if (!facility) return [];
    const list: Txn[] = [];
    // Event revenue from paid bookings.
    for (const b of data.bookings) {
      if (b.facility_id !== facility.id) continue;
      if (!['confirmed', 'completed'].includes(b.status)) continue;
      list.push({
        date: b.balance_paid_at || b.start_time, type: 'Booking', customer: renterName(data, b.renter_id),
        description: `${b.event_name} — ${spaceName(data, b.space_id)}`, gross: b.subtotal_cents,
        fee: b.platform_fee_cents, net: b.subtotal_cents - b.platform_fee_cents, status: b.status,
      });
    }
    // Tenant/lease income from invoices not tied to a single booking.
    for (const inv of data.invoices) {
      if (inv.facility_id !== facility.id || inv.booking_id) continue;
      if (!['paid', 'sent', 'overdue'].includes(inv.status)) continue;
      list.push({
        date: inv.paid_at || inv.created_at, type: 'Tenant invoice', customer: renterName(data, inv.renter_id),
        description: inv.line_items?.[0]?.label || inv.invoice_number, gross: inv.total_cents,
        fee: inv.platform_fee_cents, net: inv.total_cents - inv.platform_fee_cents, status: inv.status,
      });
    }
    return list
      .filter((t) => new Date(t.date).getFullYear() === year)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [data, facility, year]);

  if (!facility) return <EmptyState title="No facility yet" />;

  const gross = txns.reduce((s, t) => s + t.gross, 0);
  const fees = txns.reduce((s, t) => s + t.fee, 0);
  const net = gross - fees;
  const byMonth = MONTHS.map((m, i) => {
    const rows = txns.filter((t) => new Date(t.date).getMonth() === i);
    return { month: m, gross: rows.reduce((s, t) => s + t.gross, 0), fee: rows.reduce((s, t) => s + t.fee, 0) };
  });

  const years = (() => {
    const set = new Set<number>([new Date().getFullYear()]);
    data.bookings.forEach((b) => b.facility_id === facility.id && set.add(new Date(b.start_time).getFullYear()));
    return [...set].sort((a, b) => b - a);
  })();

  function exportTransactions() {
    const header = ['Date', 'Type', 'Customer', 'Description', 'Gross', 'Platform Fee', 'Net', 'Status'];
    const rows = txns.map((t) => [
      t.date.slice(0, 10), t.type, t.customer, t.description,
      (t.gross / 100).toFixed(2), (t.fee / 100).toFixed(2), (t.net / 100).toFixed(2), t.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    download(`sanctum-transactions-${year}.csv`, csv);
  }

  function exportStatement() {
    const header = ['Month', 'Gross revenue', 'Platform fees', 'Net to community'];
    const rows = byMonth.map((m) => [m.month, (m.gross / 100).toFixed(2), (m.fee / 100).toFixed(2), ((m.gross - m.fee) / 100).toFixed(2)]);
    rows.push(['TOTAL', (gross / 100).toFixed(2), (fees / 100).toFixed(2), (net / 100).toFixed(2)]);
    const csv = [[`${facility!.name} — Year-end statement ${year}`], [], header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    download(`sanctum-year-end-${year}.csv`, csv);
  }

  return (
    <div>
      <PageHeader
        title="Financials"
        subtitle="Clean books for your treasurer — export transactions and year-end statements."
        action={
          <div className="flex items-center gap-2">
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={`Gross revenue ${year}`} value={formatCents(gross)} sub={`${txns.length} transactions`} tone="primary" />
        <Stat label="Platform fees (1.5%)" value={formatCents(fees)} tone="gold" />
        <Stat label="Net to your community" value={formatCents(net)} tone="success" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={exportTransactions}><FileSpreadsheet className="h-4 w-4" /> Transactions CSV</Button>
        <Button variant="outline" onClick={exportStatement}><Download className="h-4 w-4" /> Year-end statement (CSV)</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print statement</Button>
      </div>

      <QuickBooksCard facilityId={facility.id} year={year} txnCount={txns.length} />

      <Card className="mt-6"><CardBody>
        <h2 className="font-semibold">Monthly summary — {year}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 text-left text-xs text-stone-warm">
              <tr><th className="py-2 pr-4">Month</th><th className="py-2 px-4 text-right">Gross</th><th className="py-2 px-4 text-right">Fees</th><th className="py-2 pl-4 text-right">Net</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="py-2 pr-4">{m.month}</td>
                  <td className="py-2 px-4 text-right tabular">{formatCents(m.gross)}</td>
                  <td className="py-2 px-4 text-right tabular text-stone-warm">{formatCents(m.fee)}</td>
                  <td className="py-2 pl-4 text-right tabular font-medium">{formatCents(m.gross - m.fee)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-black/10 font-semibold">
              <tr><td className="py-2 pr-4">Total</td><td className="py-2 px-4 text-right tabular">{formatCents(gross)}</td><td className="py-2 px-4 text-right tabular">{formatCents(fees)}</td><td className="py-2 pl-4 text-right tabular text-success">{formatCents(net)}</td></tr>
            </tfoot>
          </table>
        </div>
      </CardBody></Card>

      <Card className="mt-5"><CardBody>
        <h2 className="font-semibold">Transactions</h2>
        {txns.length === 0 ? (
          <p className="mt-3 text-sm text-stone-warm">No transactions in {year} yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-black/5 text-left text-xs text-stone-warm">
                <tr><th className="py-2 pr-4">Date</th><th className="py-2 px-4">Type</th><th className="py-2 px-4">Customer</th><th className="py-2 px-4">Description</th><th className="py-2 pl-4 text-right">Net</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {txns.map((t, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 whitespace-nowrap">{t.date.slice(0, 10)}</td>
                    <td className="py-2 px-4"><Badge tone={t.type === 'Booking' ? 'primary' : 'gold'}>{t.type}</Badge></td>
                    <td className="py-2 px-4">{t.customer}</td>
                    <td className="py-2 px-4 text-stone-warm">{t.description}</td>
                    <td className="py-2 pl-4 text-right tabular font-medium">{formatCents(t.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody></Card>
    </div>
  );
}

function QuickBooksCard({ facilityId, year, txnCount }: { facilityId: string; year: number; txnCount: number }) {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; available: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get('qbo') === 'connected') toast.success('QuickBooks connected');
    if (params.get('qbo') === 'error') toast.error('QuickBooks connection failed — please try again');
    if (params.get('qbo')) { params.delete('qbo'); setParams(params, { replace: true }); }
    if (!isLive()) { setStatus({ connected: false, available: false }); return; }
    api<{ connected: boolean; available: boolean }>(`/qbo/status?facility_id=${facilityId}`).then(setStatus).catch(() => setStatus({ connected: false, available: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  async function connect() {
    if (!isLive()) { toast.info('Connect QuickBooks from your live account.'); return; }
    setBusy(true);
    try {
      const res = await api<{ url?: string; demo?: boolean; error?: string }>(`/qbo/connect?facility_id=${facilityId}`);
      if (res.url) { window.location.href = res.url; return; }
      toast.info(res.error || 'QuickBooks isn\'t enabled yet.');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function sync() {
    setBusy(true);
    try {
      const res = await api<{ synced: number; total: number; errors: string[] }>('/qbo/sync', { body: { facility_id: facilityId, year } });
      toast.success(`Synced ${res.synced} of ${res.total} transactions to QuickBooks${res.errors?.length ? ` (${res.errors.length} skipped)` : ''}`);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try { await api('/qbo/disconnect', { body: { facility_id: facilityId } }); setStatus({ connected: false, available: true }); toast.success('QuickBooks disconnected'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Card className="mt-6"><CardBody>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">QuickBooks Online {status?.connected && <Badge tone="success"><Check className="h-3.5 w-3.5" /> Connected</Badge>}</h2>
          <p className="mt-1 text-sm text-stone-warm">Push your {year} transactions straight into QuickBooks as sales receipts — no CSV juggling.</p>
        </div>
        <div className="flex gap-2">
          {status?.connected ? (
            <>
              <Button loading={busy} onClick={sync} disabled={txnCount === 0}><RefreshCw className="h-4 w-4" /> Sync {year}</Button>
              <Button variant="ghost" loading={busy} onClick={disconnect}>Disconnect</Button>
            </>
          ) : (
            <Button variant="outline" loading={busy} onClick={connect}><Link2 className="h-4 w-4" /> Connect QuickBooks</Button>
          )}
        </div>
      </div>
      {status && !status.available && status !== null && !status.connected && (
        <p className="mt-2 text-xs text-stone-warm">A live sync requires the QuickBooks app to be enabled on this deployment. The CSV exports above work for everyone in the meantime.</p>
      )}
    </CardBody></Card>
  );
}
