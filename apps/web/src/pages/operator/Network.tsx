import { useState } from 'react';
import { toast } from 'sonner';
import { Network as NetworkIcon, ExternalLink, Save, Building2, Check } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Textarea, Badge, Stat, EmptyState } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { formatCents } from '../../lib/format.js';
import { notifyError } from '../../lib/errors.js';
import type { Network } from '@sanctum/shared';

export default function NetworkAdmin() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const network = data.networks.find((n) => n.owner_id === user!.id);

  if (!network) {
    return (
      <div>
        <PageHeader title="Network" subtitle="White-label for dioceses, associations & conferences." />
        <EmptyState icon={<NetworkIcon className="h-8 w-8" />} title="You don't run a network yet" body="Networks let a diocese, association, or conference bring many communities under one branded page with rolled-up reporting. Contact us to set one up." action={<Button asLink="mailto:hello@sanctum.garden?subject=Sanctum%20network%20licensing">Talk to us about licensing</Button>} />
      </div>
    );
  }

  const memberFacilities = data.facilities.filter((f) => f.network_id === network.id);
  const myFacilities = data.facilities.filter((f) => f.operator_id === user!.id);
  const memberIds = new Set(memberFacilities.map((f) => f.id));
  const gmv = data.bookings.filter((b) => memberIds.has(b.facility_id) && ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
  const spaces = data.spaces.filter((s) => memberIds.has(s.facility_id)).length;

  const [form, setForm] = useState<Network>(network);
  const [busy, setBusy] = useState(false);
  function set<K extends keyof Network>(k: K, v: Network[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true);
    try { await wt('networks', { ...form, updated_at: new Date().toISOString() }); toast.success('Network saved'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function toggleMember(facilityId: string, join: boolean) {
    const fac = data.facilities.find((f) => f.id === facilityId);
    if (!fac) return;
    try { await wt('facilities', { ...fac, network_id: join ? network!.id : null, updated_at: new Date().toISOString() }); toast.success(join ? 'Added to network' : 'Removed from network'); }
    catch (e) { notifyError(e); }
  }

  return (
    <div>
      <PageHeader
        title={network.name}
        subtitle="Your white-label network."
        action={<Button variant="outline" asLink={`/n/${network.slug}`}>View public page <ExternalLink className="h-4 w-4" /></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Communities" value={memberFacilities.length} tone="primary" />
        <Stat label="Spaces" value={spaces} />
        <Stat label="Network GMV" value={formatCents(gmv)} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardBody className="space-y-4">
          <h2 className="font-semibold">Branding</h2>
          <Input label="Network name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Textarea label="Description" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Brand color</label>
            <input type="color" value={form.brand_primary} onChange={(e) => set('brand_primary', e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-black/10" />
            <span className="font-mono text-xs text-stone-warm">{form.brand_primary}</span>
          </div>
          <Input label="Logo URL (optional)" value={form.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} />
          <p className="text-xs text-stone-warm">Your public page lives at <span className="font-mono">sanctum.garden/n/{form.slug}</span></p>
          <div className="flex justify-end"><Button onClick={save} loading={busy}><Save className="h-4 w-4" /> Save branding</Button></div>
        </CardBody></Card>

        <Card><CardBody>
          <h2 className="font-semibold">Communities in this network</h2>
          <p className="mt-1 text-sm text-stone-warm">Add the communities you operate. (Platform admin can add communities run by others.)</p>
          <div className="mt-3 space-y-2">
            {myFacilities.map((f) => {
              const inNetwork = f.network_id === network.id;
              return (
                <div key={f.id} className="flex items-center justify-between rounded-card border border-black/5 px-3 py-2">
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-stone-warm" /><span className="text-sm font-medium">{f.name}</span></div>
                  {inNetwork
                    ? <Button size="sm" variant="ghost" onClick={() => toggleMember(f.id, false)}>Remove</Button>
                    : <Button size="sm" variant="outline" onClick={() => toggleMember(f.id, true)}><Check className="h-3.5 w-3.5" /> Add</Button>}
                </div>
              );
            })}
            {memberFacilities.filter((f) => f.operator_id !== user!.id).map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-card border border-black/5 bg-cream px-3 py-2">
                <span className="text-sm font-medium">{f.name}</span>
                <Badge tone="neutral">Partner community</Badge>
              </div>
            ))}
          </div>
        </CardBody></Card>
      </div>
    </div>
  );
}
