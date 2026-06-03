import { Link } from 'react-router-dom';
import { Building2, ExternalLink, Check } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Badge, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { formatCents } from '../../lib/format.js';
import { PLAN_DETAILS } from '@sanctum/shared';

export default function AdminFacilities() {
  const data = useStore((d) => d);

  return (
    <div>
      <PageHeader title="Facilities" subtitle="Every community on the platform." />
      {data.facilities.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />} title="No facilities yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 bg-cream text-left text-xs text-stone-warm">
              <tr><th className="px-4 py-3">Facility</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Payouts</th><th className="px-4 py-3">Spaces</th><th className="px-4 py-3">GMV</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.facilities.map((f) => {
                const spaces = data.spaces.filter((s) => s.facility_id === f.id).length;
                const gmv = data.bookings.filter((b) => b.facility_id === f.id && ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-stone-warm">{f.city}, {f.state}</td>
                    <td className="px-4 py-3"><Badge tone="primary">{PLAN_DETAILS[f.plan].name}</Badge></td>
                    <td className="px-4 py-3">{f.stripe_onboarded ? <Badge tone="success"><Check className="h-3 w-3" /> Connected</Badge> : <Badge tone="neutral">Pending</Badge>}</td>
                    <td className="px-4 py-3 tabular">{spaces}</td>
                    <td className="px-4 py-3 tabular font-semibold">{formatCents(gmv)}</td>
                    <td className="px-4 py-3 text-right"><Link to={`/c/${f.slug}`} className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
