import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Send, Users, Repeat } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Badge, Input, Select, Textarea, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { api } from '../../lib/api.js';
import { notifyError } from '../../lib/errors.js';
import { formatDate } from '../../lib/format.js';

type Audience = 'all' | 'tenants' | 'renters';
interface Sent { id: string; title: string; body: string | null; audience: string; recipient_count: number; created_at: string }

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Tenants + upcoming renters',
  tenants: 'Recurring tenants',
  renters: 'Renters with upcoming bookings',
};

export default function Announcements() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Sent[]>([]);

  // Recipient keys per audience, deduped the same way the server does — so the
  // count the operator sees matches who actually receives it.
  const counts = useMemo(() => {
    if (!facility) return { all: 0, tenants: 0, renters: 0 };
    const now = Date.now();
    const activeLeases = data.leases.filter((l) => l.facility_id === facility.id && l.status === 'active');
    const upcomingRenterIds = new Set(
      data.bookings
        .filter((b) => b.facility_id === facility.id && ['approved', 'confirmed'].includes(b.status) && new Date(b.start_time).getTime() >= now)
        .map((b) => b.renter_id),
    );
    const tenantKeys = new Set<string>();
    for (const l of activeLeases) {
      if (l.renter_id) tenantKeys.add(`u:${l.renter_id}`);
      else if (l.tenant_email) tenantKeys.add(`e:${l.tenant_email.toLowerCase()}`);
    }
    const renterKeys = new Set([...upcomingRenterIds].map((id) => `u:${id}`));
    const allKeys = new Set([...tenantKeys, ...renterKeys]);
    return { all: allKeys.size, tenants: tenantKeys.size, renters: renterKeys.size };
  }, [data.leases, data.bookings, facility]);

  useEffect(() => {
    if (!facility) return;
    api<{ announcements: Sent[] }>(`/operator/announcements?facility_id=${facility.id}`)
      .then((r) => setHistory(r.announcements || []))
      .catch(() => {});
  }, [facility]);

  if (!facility) return <EmptyState title="No facility yet" />;

  const recipientCount = counts[audience];

  async function send() {
    if (!facility) return;
    if (!title.trim()) { toast.error('Add a subject first.'); return; }
    if (recipientCount === 0) { toast.error('No one matches this audience yet.'); return; }
    if (!confirm(`Send "${title.trim()}" to ${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}?`)) return;
    setBusy(true);
    try {
      const res = await api<{ recipients: number }>('/operator/announce', {
        body: { facility_id: facility.id, title: title.trim(), body: body.trim(), audience },
      });
      toast.success(`Sending to ${res.recipients} ${res.recipients === 1 ? 'person' : 'people'} — they'll get it shortly`);
      setTitle(''); setBody('');
      const r = await api<{ announcements: Sent[] }>(`/operator/announcements?facility_id=${facility.id}`);
      setHistory(r.announcements || []);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Send an alert to your tenants and upcoming renters — closures, schedule changes, or a warm note. Delivered in-app and by email."
      />

      <Card data-tour="announce-compose"><CardBody className="space-y-4">
        <Input label="Subject" placeholder="Hall closed Saturday for floor refinishing" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Textarea label="Message" rows={5} placeholder="Share the details — what's happening, when, and anything people should do." value={body} onChange={(e) => setBody(e.target.value)} />

        <div className="grid gap-3 sm:grid-cols-2" data-tour="announce-audience">
          <Select label="Send to" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            <option value="all">Tenants + upcoming renters</option>
            <option value="tenants">Recurring tenants only</option>
            <option value="renters">Renters with upcoming bookings only</option>
          </Select>
          <div className="flex items-end">
            <div className="rounded-card border border-black/10 bg-stone-50 px-4 py-2.5 text-sm">
              <span className="font-semibold text-primary-700">{recipientCount}</span>
              <span className="text-stone-warm"> {recipientCount === 1 ? 'recipient' : 'recipients'}</span>
              <span className="ml-2 inline-flex gap-2 text-xs text-stone-warm">
                <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" /> {counts.tenants}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {counts.renters}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <p className="text-xs text-stone-warm">Recipients get an in-app notification and, if they have an email on file, a message from {facility.name}.</p>
          <Button loading={busy} onClick={send} disabled={!title.trim() || recipientCount === 0}>
            <Send className="h-4 w-4" /> Send announcement
          </Button>
        </div>
      </CardBody></Card>

      <Card className="mt-6" data-tour="announce-history"><CardBody>
        <h2 className="font-semibold">Recent announcements</h2>
        {history.length === 0 ? (
          <div className="mt-3"><EmptyState icon={<Megaphone className="h-8 w-8" />} title="Nothing sent yet" body="Your announcements will show up here once you send one." /></div>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {history.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    {a.body && <p className="mt-0.5 line-clamp-2 text-sm text-stone-warm">{a.body}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="neutral">{a.recipient_count} sent</Badge>
                    <p className="mt-1 text-xs text-stone-warm">{formatDate(a.created_at)}</p>
                  </div>
                </div>
                <p className="mt-1 text-xs text-stone-warm">{AUDIENCE_LABEL[a.audience] || a.audience}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody></Card>
    </div>
  );
}
