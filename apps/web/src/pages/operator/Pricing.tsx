import { useState } from 'react';
import { toast } from 'sonner';
import { Tag, Save } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, EmptyState } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { ORG_TYPE_LABELS, type OrgType } from '@sanctum/shared';

// Organization types eligible for community discounts.
const DISCOUNTABLE: OrgType[] = ['nonprofit', 'school', 'religious', 'community_group', 'government'];

export default function Pricing() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const rules = data.pricing_rules.filter((r) => r.facility_id === facility.id);

  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    DISCOUNTABLE.forEach((t) => { o[t] = String(rules.find((r) => r.org_type === t)?.discount_percent ?? ''); });
    return o;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      for (const org of DISCOUNTABLE) {
        const pct = parseFloat(draft[org] || '0') || 0;
        const existing = data.pricing_rules.find((r) => r.facility_id === facility!.id && r.org_type === org);
        if (!existing && pct === 0) continue; // nothing to create
        if (existing && existing.discount_percent === pct) continue; // unchanged
        const now = new Date().toISOString();
        await wt('pricing_rules', {
          id: existing?.id || genId('pr'), facility_id: facility!.id, org_type: org,
          discount_percent: Math.min(100, Math.max(0, pct)),
          created_at: existing?.created_at || now, updated_at: now,
        });
      }
      toast.success('Discounts saved');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pricing & discounts" subtitle="Offer automatic discounts to the community groups you most want to welcome." />
      <Card><CardBody className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-stone-warm"><Tag className="h-4 w-4 text-primary" /> Discounts apply automatically based on the renter's organization type.</div>
        <div className="space-y-3">
          {DISCOUNTABLE.map((org) => (
            <div key={org} className="flex items-center gap-3">
              <span className="w-40 text-sm font-medium">{ORG_TYPE_LABELS[org]}</span>
              <div className="relative flex-1">
                <Input type="number" min={0} max={100} placeholder="0" value={draft[org]} onChange={(e) => setDraft({ ...draft, [org]: e.target.value })} className="pr-8" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-warm">%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end"><Button loading={busy} onClick={save}><Save className="h-4 w-4" /> Save discounts</Button></div>
      </CardBody></Card>
      <p className="mt-3 text-xs text-stone-warm">Renters set their organization type on their profile. The discount is applied to the space subtotal when they book — and shown transparently in their price breakdown.</p>
    </div>
  );
}
