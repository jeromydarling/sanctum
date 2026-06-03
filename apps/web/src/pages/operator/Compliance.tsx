import { toast } from 'sonner';
import { ShieldCheck, Check, X, FileText } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Badge, Button, EmptyState } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, renterName } from '../../lib/selectors.js';
import { formatCents, formatDate } from '../../lib/format.js';
import { notifyError } from '../../lib/errors.js';
import type { ComplianceDoc } from '@sanctum/shared';

export default function Compliance() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const docs = data.compliance_docs.filter((c) => c.facility_id === facility.id);
  const pending = docs.filter((d) => d.status === 'pending');
  const reviewed = docs.filter((d) => d.status !== 'pending');

  async function review(doc: ComplianceDoc, status: 'approved' | 'rejected') {
    try {
      await wt('compliance_docs', { ...doc, status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() });
      toast.success(status === 'approved' ? 'Insurance approved' : 'Marked as rejected');
    } catch (e) { notifyError(e); }
  }

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Review certificates of insurance and signed agreements before events." />
      {docs.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="Nothing to review" body="Insurance documents from renters will appear here." />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-warm">Needs review ({pending.length})</h2>
              <div className="space-y-3">{pending.map((d) => <DocRow key={d.id} doc={d} renter={renterName(data, d.renter_id)} onReview={review} />)}</div>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-warm">Reviewed</h2>
              <div className="space-y-3">{reviewed.map((d) => <DocRow key={d.id} doc={d} renter={renterName(data, d.renter_id)} onReview={review} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, renter, onReview }: { doc: ComplianceDoc; renter: string; onReview: (d: ComplianceDoc, s: 'approved' | 'rejected') => void }) {
  const tone = doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'danger' : doc.status === 'expired' ? 'warning' : 'warning';
  return (
    <Card><CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-card bg-primary-50 text-primary"><FileText className="h-5 w-5" /></span>
        <div>
          <p className="font-medium">{renter} — Certificate of Insurance</p>
          <p className="text-sm text-stone-warm">
            {doc.insurer_name || 'Insurer pending'}{doc.policy_number ? ` · #${doc.policy_number}` : ''}
            {doc.coverage_amount_cents ? ` · ${formatCents(doc.coverage_amount_cents)} coverage` : ''}
          </p>
          {doc.expiration_date && <p className="text-xs text-stone-warm">Expires {formatDate(doc.expiration_date)}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={tone}>{doc.status}</Badge>
        {doc.status === 'pending' && (
          <>
            <Button size="sm" variant="outline" onClick={() => onReview(doc, 'rejected')}><X className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => onReview(doc, 'approved')}><Check className="h-4 w-4" /> Approve</Button>
          </>
        )}
      </div>
    </CardBody></Card>
  );
}
