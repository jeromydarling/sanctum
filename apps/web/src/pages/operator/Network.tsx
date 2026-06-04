import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Network as NetworkIcon, ExternalLink, Save, Building2, Check, Mail, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Textarea, Badge, Stat, EmptyState, Spinner } from '../../components/ui.js';
import { useStore, wt, rehydrate } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { api } from '../../lib/api.js';
import { isLive } from '../../lib/config.js';
import { formatCents } from '../../lib/format.js';
import { notifyError } from '../../lib/errors.js';
import type { Network } from '@sanctum/shared';

export default function NetworkAdmin() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const [params] = useSearchParams();
  const inviteToken = params.get('invite');
  const network = data.networks.find((n) => n.owner_id === user!.id);

  // An incoming invitation takes over the page.
  if (inviteToken) return <AcceptInvite token={inviteToken} />;

  if (!network) {
    return (
      <div>
        <PageHeader title="Network" subtitle="White-label for dioceses, associations & conferences." />
        <EmptyState icon={<NetworkIcon className="h-8 w-8" />} title="You don't run a network yet" body="Networks let a diocese, association, or conference bring many communities under one branded page with rolled-up reporting. Contact us to set one up." action={<Button asLink="mailto:hello@sanctum.garden?subject=Sanctum%20network%20licensing">Talk to us about licensing</Button>} />
      </div>
    );
  }

  return <NetworkOwner network={network} userId={user!.id} />;
}

function NetworkOwner({ network, userId }: { network: Network; userId: string }) {
  const data = useStore((d) => d);
  const memberFacilities = data.facilities.filter((f) => f.network_id === network.id);
  const myFacilities = data.facilities.filter((f) => f.operator_id === userId);
  const memberIds = new Set(memberFacilities.map((f) => f.id));
  const gmv = data.bookings.filter((b) => memberIds.has(b.facility_id) && ['confirmed', 'completed'].includes(b.status)).reduce((s, b) => s + b.subtotal_cents, 0);
  const spaces = data.spaces.filter((s) => memberIds.has(s.facility_id)).length;

  const [form, setForm] = useState<Network>(network);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  function set<K extends keyof Network>(k: K, v: Network[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true);
    try { await wt('networks', { ...form, updated_at: new Date().toISOString() }); toast.success('Network saved'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function toggleMember(facilityId: string, join: boolean) {
    const fac = data.facilities.find((f) => f.id === facilityId);
    if (!fac) return;
    try { await wt('facilities', { ...fac, network_id: join ? network.id : null, updated_at: new Date().toISOString() }); toast.success(join ? 'Added to network' : 'Removed from network'); }
    catch (e) { notifyError(e); }
  }

  async function invite() {
    if (!inviteEmail.trim()) { toast.error('Enter the community\'s email'); return; }
    setInviting(true);
    try {
      if (isLive()) await api('/networks/invite', { body: { network_id: network.id, email: inviteEmail } });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (e) { notifyError(e); } finally { setInviting(false); }
  }

  return (
    <div>
      <PageHeader title={network.name} subtitle="Your white-label network." action={<Button variant="outline" asLink={`/n/${network.slug}`}>View public page <ExternalLink className="h-4 w-4" /></Button>} />
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

        <div className="space-y-6">
          <Card><CardBody>
            <h2 className="font-semibold">Your communities</h2>
            <p className="mt-1 text-sm text-stone-warm">Add the communities you operate.</p>
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
            </div>
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-primary" /> Invite a community</h2>
            <p className="mt-1 text-sm text-stone-warm">Invite a parish, congregation, or partner that you don't operate. They'll get an email to add their community.</p>
            <div className="mt-3 flex gap-2">
              <Input type="email" placeholder="contact@anotherchurch.org" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <Button loading={inviting} onClick={invite}><Mail className="h-4 w-4" /> Invite</Button>
            </div>
            {memberFacilities.filter((f) => f.operator_id !== userId).length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-warm">Partner communities</p>
                {memberFacilities.filter((f) => f.operator_id !== userId).map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-card bg-cream px-3 py-2 text-sm"><span className="font-medium">{f.name}</span><Badge tone="neutral">Joined</Badge></div>
                ))}
              </div>
            )}
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}

function AcceptInvite({ token }: { token: string }) {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const myFacilities = data.facilities.filter((f) => f.operator_id === user!.id);
  const [info, setInfo] = useState<{ network_name: string; network_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isLive()) { setError('Network invitations work on your live account.'); setLoading(false); return; }
    api<{ network_name: string; network_id: string }>(`/networks/invite-info?token=${encodeURIComponent(token)}`)
      .then(setInfo).catch((e) => setError(e instanceof Error ? e.message : 'Invalid invitation')).finally(() => setLoading(false));
  }, [token]);

  async function accept(facilityId: string) {
    setBusy(facilityId);
    try {
      await api('/networks/accept', { body: { token, facility_id: facilityId } });
      await rehydrate();
      toast.success(`Joined ${info?.network_name || 'the network'}`);
    } catch (e) { notifyError(e); } finally { setBusy(null); }
  }

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  if (error || !info) {
    return <div><PageHeader title="Network invitation" /><EmptyState icon={<NetworkIcon className="h-8 w-8" />} title="We couldn't open this invitation" body={error || 'It may have expired.'} action={<Button asLink="/operator/network">Go to Network</Button>} /></div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="You're invited" subtitle={`Join ${info.network_name}`} />
      <Card><CardBody className="space-y-3">
        <p className="text-sm text-stone-warm">Choose which of your communities to add to <strong className="text-ink">{info.network_name}</strong>. They'll appear on the network's branded page.</p>
        {myFacilities.length === 0 ? (
          <p className="text-sm text-stone-warm">You don't have a community yet. Set one up first, then accept this invite.</p>
        ) : myFacilities.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-card border border-black/5 px-3 py-2">
            <span className="text-sm font-medium">{f.name}</span>
            {f.network_id === info.network_id
              ? <Badge tone="success"><Check className="h-3.5 w-3.5" /> Joined</Badge>
              : <Button size="sm" loading={busy === f.id} onClick={() => accept(f.id)}>Join</Button>}
          </div>
        ))}
      </CardBody></Card>
    </div>
  );
}
