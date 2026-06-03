import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, EmptyState, Spinner, Badge } from '../../components/ui.js';
import { api } from '../../lib/api.js';
import { isDemo } from '../../lib/config.js';
import { formatDateTime } from '../../lib/format.js';

interface ErrLog { id: string; incident_id: string | null; source: string | null; message: string | null; url: string | null; created_at: string; }

export default function Errors() {
  const [errors, setErrors] = useState<ErrLog[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo()) { setErrors([]); setLoading(false); return; }
    (async () => {
      try { const res = await api<{ errors: ErrLog[] }>('/admin/errors'); setErrors(res.errors); }
      catch { setErrors([]); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Error log" subtitle="Telemetry from across the platform — caught, logged, and ready to triage." />
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : !errors?.length ? (
        <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="All quiet" body={isDemo() ? 'The error log is live-only — sign in to a real account to see captured incidents.' : 'No errors captured. Resilience handlers are watching.'} />
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-card bg-danger/10 text-danger"><AlertTriangle className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{e.source}</Badge>
                    {e.incident_id && <span className="font-mono text-xs text-stone-warm">{e.incident_id}</span>}
                  </div>
                  <p className="mt-1 break-words text-sm">{e.message}</p>
                  <p className="mt-0.5 text-xs text-stone-warm">{e.url} · {formatDateTime(e.created_at)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
