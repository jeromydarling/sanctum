/** Two-way calendar sync card for operator Settings. */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Copy, RefreshCw, Check, ExternalLink } from 'lucide-react';
import { Card, CardBody, Button, Input } from './ui.js';
import { api } from '../lib/api.js';
import { isLive } from '../lib/config.js';
import { notifyError } from '../lib/errors.js';
import type { Facility } from '@sanctum/shared';

export function CalendarSyncCard({ facility }: { facility: Facility }) {
  const live = isLive();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [external, setExternal] = useState(facility.external_ical_url || '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!live) return;
    api<{ url: string }>(`/ical/subscribe-url?facility_id=${facility.id}`)
      .then((r) => setFeedUrl(r.url))
      .catch(() => {});
  }, [facility.id, live]);

  function copy() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function importNow() {
    if (!live) { toast.info('Calendar sync runs on your live account.'); return; }
    setBusy(true);
    try {
      const res = await api<{ imported: number; cleared?: boolean }>('/ical/import', { body: { facility_id: facility.id, url: external } });
      toast.success(res.cleared ? 'Calendar disconnected' : `Synced ${res.imported} event${res.imported !== 1 ? 's' : ''} — those times are now protected`);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Card className="mt-5"><CardBody className="space-y-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Calendar sync</h2>
      </div>

      {/* Export */}
      <div>
        <h3 className="text-sm font-semibold">Subscribe to your Sanctum calendar</h3>
        <p className="mt-1 text-sm text-stone-warm">Add this feed to Google Calendar or Outlook to see every booking and recurring tenant alongside your own schedule.</p>
        {live && feedUrl ? (
          <div className="mt-2 flex gap-2">
            <input readOnly value={feedUrl} className="input-base flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
          </div>
        ) : (
          <p className="mt-2 rounded-card bg-cream px-3 py-2 text-xs text-stone-warm">Your private feed URL appears here on your live account.</p>
        )}
      </div>

      {/* Import */}
      <div className="border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold">Protect against your own events</h3>
        <p className="mt-1 text-sm text-stone-warm">Paste your church's Google/Outlook/iCal feed. We'll block those times so a rental can never collide with your own ministries, choir, or services.</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input placeholder="https://calendar.google.com/…/basic.ics" value={external} onChange={(e) => setExternal(e.target.value)} className="font-mono text-xs" />
          <Button variant="outline" loading={busy} onClick={importNow}><RefreshCw className="h-4 w-4" /> {external ? 'Sync now' : 'Disconnect'}</Button>
        </div>
        <a href="https://support.google.com/calendar/answer/37648" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Where do I find my calendar's secret iCal URL? <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-1 text-xs text-stone-warm">Re-synced automatically every day.</p>
      </div>
    </CardBody></Card>
  );
}
