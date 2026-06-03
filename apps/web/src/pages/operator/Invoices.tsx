import { toast } from 'sonner';
import { FileText, Send, Check } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Badge, Button, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, renterName } from '../../lib/selectors.js';
import { formatCents, formatDate } from '../../lib/format.js';
import { invoiceAction } from '../../lib/actions.js';
import { notifyError } from '../../lib/errors.js';
import type { InvoiceStatus } from '@sanctum/shared';

const TONE: Record<InvoiceStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral', sent: 'primary', paid: 'success', overdue: 'warning', void: 'danger',
};

export default function Invoices() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const invoices = data.invoices.filter((i) => i.facility_id === facility.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total_cents, 0);
  const collected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total_cents, 0);

  async function act(id: string, action: 'send' | 'paid') {
    try { await invoiceAction(id, action); toast.success(action === 'paid' ? 'Marked paid' : 'Invoice sent'); }
    catch (e) { notifyError(e); }
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Track what's billed, sent, and collected." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Card><CardBody><p className="text-xs font-semibold uppercase text-stone-warm">Collected</p><p className="tabular mt-1 text-2xl font-bold text-success">{formatCents(collected)}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs font-semibold uppercase text-stone-warm">Outstanding</p><p className="tabular mt-1 text-2xl font-bold text-gold-dark">{formatCents(outstanding)}</p></CardBody></Card>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices yet" body="Create an invoice from any approved booking." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 bg-cream text-left text-xs text-stone-warm">
              <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Renter</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3"><p className="font-medium">{inv.invoice_number}</p><p className="text-xs text-stone-warm">{formatDate(inv.created_at)}</p></td>
                  <td className="px-4 py-3">{renterName(data, inv.renter_id)}</td>
                  <td className="px-4 py-3 tabular font-semibold">{formatCents(inv.total_cents)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[inv.status]}>{inv.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === 'draft' && <Button size="sm" variant="outline" onClick={() => act(inv.id, 'send')}><Send className="h-3.5 w-3.5" /> Send</Button>}
                    {(inv.status === 'sent' || inv.status === 'overdue') && <Button size="sm" onClick={() => act(inv.id, 'paid')}><Check className="h-3.5 w-3.5" /> Mark paid</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
