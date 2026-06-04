import { toast } from 'sonner';
import { Megaphone, Mail, ArrowRight } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Badge, Button, EmptyState } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { formatDate } from '../../lib/format.js';
import { notifyError } from '../../lib/errors.js';
import type { Lead } from '@sanctum/shared';

const STAGES: { key: Lead['stage']; label: string; tone: 'warning' | 'primary' | 'success' | 'neutral' }[] = [
  { key: 'inquiry', label: 'Reached out', tone: 'warning' },
  { key: 'tour', label: 'Visiting', tone: 'primary' },
  { key: 'booked', label: 'Welcomed', tone: 'success' },
  { key: 'lost', label: 'Not this time', tone: 'neutral' },
];

export default function Leads() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const leads = data.leads.filter((l) => l.facility_id === facility.id);

  async function advance(lead: Lead, stage: Lead['stage']) {
    try { await wt('leads', { ...lead, stage }); toast.success(`Moved to ${stage}`); }
    catch (e) { notifyError(e); }
  }

  return (
    <div>
      <PageHeader title="Inquiries" subtitle="Everyone who's reached out — from first hello to a warm welcome. No one falls through the cracks." />
      {leads.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="No inquiries yet" body="Messages from your public page land here so nothing slips through." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => l.stage === stage.key);
            return (
              <div key={stage.key}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{stage.label}</h3>
                  <Badge tone={stage.tone}>{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {items.map((l) => {
                    const next = STAGES[STAGES.findIndex((s) => s.key === l.stage) + 1];
                    return (
                      <Card key={l.id}><CardBody className="space-y-2">
                        <p className="font-medium">{l.name}</p>
                        {l.organization && <p className="text-xs text-stone-warm">{l.organization}</p>}
                        <p className="line-clamp-3 text-sm text-ink/70">{l.message}</p>
                        <p className="text-xs text-stone-warm">{formatDate(l.created_at)}</p>
                        <div className="flex items-center gap-2 pt-1">
                          {l.email && <a href={`mailto:${l.email}`} className="text-stone-warm hover:text-primary"><Mail className="h-4 w-4" /></a>}
                          {next && l.stage !== 'lost' && <Button size="sm" variant="outline" onClick={() => advance(l, next.key)}>{next.label} <ArrowRight className="h-3 w-3" /></Button>}
                        </div>
                      </CardBody></Card>
                    );
                  })}
                  {items.length === 0 && <p className="rounded-card border border-dashed border-black/10 py-6 text-center text-xs text-stone-warm">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
