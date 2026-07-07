import { useState } from 'react';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '../ui.js';
import { api } from '../../lib/api.js';
import { notifyError } from '../../lib/errors.js';
import type { Facility } from '@sanctum/shared';

/**
 * Involuntary-churn recovery. Most SaaS churn is a failed card, not a decision —
 * so when a subscription slips into past_due/unpaid (or is paused/canceled) we
 * surface a kind, high-contrast nudge to fix it before access is lost.
 */
const MESSAGES: Record<string, { title: string; body: string; cta: string; tone: 'danger' | 'warning' }> = {
  past_due: { title: 'Your last payment didn’t go through', body: 'Update your card to keep your doors open — no interruption to your bookings.', cta: 'Update payment', tone: 'danger' },
  unpaid: { title: 'Your subscription is unpaid', body: 'A quick card update keeps your community listing live.', cta: 'Update payment', tone: 'danger' },
  paused: { title: 'Your subscription is paused', body: 'Your spaces are hidden from discovery while paused. Resume whenever you’re ready.', cta: 'Resume', tone: 'warning' },
  canceled: { title: 'Your subscription was canceled', body: 'Reactivate to list your spaces and take bookings again.', cta: 'Reactivate', tone: 'warning' },
};

export function BillingBanner({ facility }: { facility: Facility }) {
  const [busy, setBusy] = useState(false);
  const status = facility.subscription_status;
  const msg = status ? MESSAGES[status] : undefined;
  if (!msg) return null;

  async function fix() {
    setBusy(true);
    try {
      // Paused → resume in one click (the save-offer's happy path).
      if (status === 'paused') {
        await api('/stripe/subscription', { body: { facility_id: facility.id, action: 'resume' } });
        window.location.reload();
        return;
      }
      // Canceled → reactivate by picking a plan again.
      if (status === 'canceled') { window.location.href = '/operator/settings'; return; }
      // Failed card → the Stripe billing portal (or Settings when simulated).
      const res = await api<{ url?: string; error?: string }>('/stripe/portal', { body: { facility_id: facility.id } });
      if (res.url) { window.location.href = res.url; return; }
      window.location.href = '/operator/settings';
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  const danger = msg.tone === 'danger';
  return (
    <div className={`mb-5 flex flex-col gap-3 rounded-card border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${danger ? 'border-danger/30 bg-danger/5' : 'border-warning/40 bg-warning/10'}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${danger ? 'text-danger' : 'text-[#9a6a00]'}`} />
        <div>
          <p className="font-semibold">{msg.title}</p>
          <p className="text-sm text-stone-warm">{msg.body}</p>
        </div>
      </div>
      <Button variant={danger ? 'danger' : 'outline'} loading={busy} onClick={fix} className="shrink-0">
        <CreditCard className="h-4 w-4" /> {msg.cta}
      </Button>
    </div>
  );
}
