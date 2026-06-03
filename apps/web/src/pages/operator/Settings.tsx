import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Check, Download, Trash2, Building2, ImagePlus } from 'lucide-react';
import { PLAN_DETAILS, PLANS, formatCents } from '@sanctum/shared';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Textarea, Badge, EmptyState, Modal } from '../../components/ui.js';
import { SmartImage } from '../../components/SmartImage.js';
import { ImageStudio } from '../../components/ImageStudio.js';
import { useStore, wt, getData } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { api } from '../../lib/api.js';
import { isLive, getToken } from '../../lib/config.js';
import { notifyError } from '../../lib/errors.js';
import type { Facility } from '@sanctum/shared';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [form, setForm] = useState<Facility | null>(facility || null);
  const [studio, setStudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!facility || !form) return <EmptyState title="No facility yet" icon={<Building2 className="h-8 w-8" />} />;
  function set<K extends keyof Facility>(k: K, v: Facility[K]) { setForm((f) => (f ? { ...f, [k]: v } : f)); }

  async function save() {
    setBusy(true);
    try { await wt('facilities', form!); toast.success('Settings saved'); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  async function connectStripe() {
    setConnecting(true);
    try {
      const res = await api<{ url?: string; demo?: boolean; onboarded?: boolean }>('/stripe/connect/create-account', { body: { facility_id: facility!.id } });
      if (res.url) { window.location.href = res.url; return; }
      set('stripe_onboarded', 1);
      await wt('facilities', { ...form!, stripe_onboarded: 1, stripe_account_id: form!.stripe_account_id || 'acct_demo' });
      toast.success('Payouts connected (demo)');
    } catch (e) { notifyError(e); } finally { setConnecting(false); }
  }

  async function exportData() {
    if (isLive()) {
      const res = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${getToken()}` } });
      const blob = await res.blob();
      downloadBlob(blob, 'sanctum-export.json');
    } else {
      downloadBlob(new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' }), 'sanctum-export-demo.json');
    }
    toast.success('Your data is downloading');
  }

  async function manageBilling() {
    setBillingBusy(true);
    try {
      const res = await api<{ url?: string; demo?: boolean; error?: string }>('/stripe/portal', { body: { facility_id: facility!.id } });
      if (res.url) { window.location.href = res.url; return; }
      toast.info(res.error || 'Billing management opens once you have an active paid subscription.');
    } catch (e) { notifyError(e); } finally { setBillingBusy(false); }
  }

  async function choosePlan(p: import('@sanctum/shared').Plan) {
    try {
      const res = await api<{ url?: string; demo?: boolean }>('/stripe/subscribe', { body: { facility_id: facility!.id, plan: p } });
      if (res.url) { window.location.href = res.url; return; }
      set('plan', p);
      await wt('facilities', { ...form!, plan: p, subscription_status: 'active' });
      toast.success(`You're on ${PLAN_DETAILS[p].name}`);
    } catch (e) { notifyError(e); }
  }

  async function deleteAccount() {
    try {
      if (isLive()) await api('/account/delete', { body: {} });
      toast.success('Account deleted');
      logout();
      navigate('/');
    } catch (e) { notifyError(e); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Your community profile, payouts, and account." />

      <Card><CardBody className="space-y-4">
        <h2 className="font-semibold">Community profile</h2>
        <div className="relative">
          <SmartImage src={form.cover_image_url} alt={form.name} emoji="⛪" seed={form.id} className="h-36 w-full rounded-card" width={1200} />
          <Button size="sm" variant="outline" className="absolute bottom-2 right-2 bg-white" onClick={() => setStudio(true)}><ImagePlus className="h-4 w-4" /> Cover image</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Denomination / affiliation (optional)" value={form.denomination || ''} onChange={(e) => set('denomination', e.target.value)} />
          <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
          <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
          <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <Input label="Phone" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          <Input label="Website" value={form.website || ''} onChange={(e) => set('website', e.target.value)} />
        </div>
        <Textarea label="About your community" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_listed === 1} onChange={(e) => set('is_listed', e.target.checked ? 1 : 0)} className="h-4 w-4" /> List us in public discovery
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.requires_approval === 1} onChange={(e) => set('requires_approval', e.target.checked ? 1 : 0)} className="h-4 w-4" /> Review each request before confirming
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.require_coi === 1} onChange={(e) => set('require_coi', e.target.checked ? 1 : 0)} className="h-4 w-4" /> Require certificate of insurance
        </label>
        <div className="flex justify-end"><Button onClick={save} loading={busy}>Save changes</Button></div>
      </CardBody></Card>

      <Card className="mt-5"><CardBody>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Payouts</h2>
            <p className="mt-1 text-sm text-stone-warm">Connect Stripe to receive booking payments — minus a transparent 1.5%.</p>
          </div>
          {form.stripe_onboarded ? <Badge tone="success"><Check className="h-3.5 w-3.5" /> Connected</Badge> : <Button onClick={connectStripe} loading={connecting}><CreditCard className="h-4 w-4" /> Connect Stripe</Button>}
        </div>
      </CardBody></Card>

      <Card className="mt-5"><CardBody>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your plan</h2>
          <Badge tone={form.subscription_status === 'active' ? 'success' : form.subscription_status === 'canceled' ? 'danger' : 'gold'}>
            {form.subscription_status === 'trialing' ? 'Free trial' : form.subscription_status || 'trialing'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-stone-warm">Every plan includes the transparent 1.5% per paid booking. Change anytime — your first 30 days are free.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => {
            const plan = PLAN_DETAILS[p];
            const current = form!.plan === p;
            return (
              <button key={p} onClick={() => choosePlan(p)}
                className={`rounded-card border-2 p-4 text-left transition ${current ? 'border-primary bg-primary-50' : 'border-black/10 hover:border-primary/30'}`}>
                <div className="flex items-center justify-between"><span className="font-display font-bold">{plan.name}</span>{current && <Badge tone="primary">Current</Badge>}</div>
                <div className="tabular mt-1 text-2xl font-bold">{formatCents(plan.priceCents)}<span className="text-sm font-normal text-stone-warm">/mo</span></div>
                <p className="mt-1 text-xs text-stone-warm">{plan.spaceLimit ? `Up to ${plan.spaceLimit} spaces` : 'Unlimited spaces'}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
          <p className="text-sm text-stone-warm">Update your card, download invoices, or cancel anytime.</p>
          <Button variant="outline" loading={billingBusy} onClick={manageBilling}><CreditCard className="h-4 w-4" /> Manage billing</Button>
        </div>
      </CardBody></Card>

      <Card className="mt-5"><CardBody className="space-y-3">
        <h2 className="font-semibold">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}><Download className="h-4 w-4" /> Export my data</Button>
          <Button variant="ghost" className="text-danger hover:bg-danger/5" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete my account</Button>
        </div>
        <p className="text-xs text-stone-warm">Exporting gives you a copy of everything we hold. Deleting erases every record you own.</p>
      </CardBody></Card>

      <ImageStudio open={studio} onClose={() => setStudio(false)} suggestedPrompt={`exterior of ${form.name}, a welcoming community building`} onApply={(url) => set('cover_image_url', url)} />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?">
        <p className="text-sm text-stone-warm">This permanently erases your facility, spaces, bookings, and documents. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Keep my account</Button><Button variant="danger" onClick={deleteAccount}>Delete everything</Button></div>
      </Modal>
    </div>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
