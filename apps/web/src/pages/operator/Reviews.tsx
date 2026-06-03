import { useState } from 'react';
import { toast } from 'sonner';
import { Star, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Textarea, EmptyState, Stat } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName, renterName } from '../../lib/selectors.js';
import { formatDate } from '../../lib/format.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import type { Review } from '@sanctum/shared';

export default function Reviews() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const reviews = data.reviews.filter((r) => r.facility_id === facility.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div>
      <PageHeader title="Reviews" subtitle="What renters are saying — and your replies." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Average rating" value={avg ? avg.toFixed(1) : '—'} sub={`${reviews.length} review${reviews.length !== 1 ? 's' : ''}`} tone="gold" />
        <Stat label="5-star reviews" value={reviews.filter((r) => r.rating === 5).length} tone="success" />
        <Stat label="Awaiting reply" value={reviews.filter((r) => !r.operator_response).length} />
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={<Star className="h-8 w-8" />} title="No reviews yet" body="After events wrap up, renters can leave a review here." />
      ) : (
        <div className="space-y-4">{reviews.map((r) => <ReviewCard key={r.id} review={r} renter={renterName(data, r.renter_id)} space={r.space_id ? spaceName(data, r.space_id) : ''} />)}</div>
      )}
    </div>
  );
}

function ReviewCard({ review, renter, space }: { review: Review; renter: string; space: string }) {
  const [reply, setReply] = useState(review.operator_response || '');
  const [editing, setEditing] = useState(!review.operator_response);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await wt('reviews', { ...review, operator_response: reply || null });
      toast.success('Reply posted');
      setEditing(false);
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Card><CardBody>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex gap-0.5 text-gold">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-4 w-4', i < review.rating ? 'fill-current' : 'text-black/15')} />)}</div>
          {review.headline && <h3 className="mt-2 font-semibold">{review.headline}</h3>}
          {review.body && <p className="mt-1 text-sm text-ink/80">{review.body}</p>}
          <p className="mt-1 text-xs text-stone-warm">{renter}{space ? ` · ${space}` : ''} · {formatDate(review.created_at)}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-black/5 pt-3">
        {!editing && review.operator_response ? (
          <div className="rounded-card bg-cream p-3">
            <p className="text-xs font-semibold text-primary-700">Your reply</p>
            <p className="mt-1 text-sm text-ink/80">{review.operator_response}</p>
            <button onClick={() => setEditing(true)} className="mt-1 text-xs font-medium text-primary hover:underline">Edit</button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thank them and share a warm note…" />
            <div className="flex justify-end gap-2">
              {review.operator_response && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
              <Button size="sm" loading={busy} onClick={save}><MessageSquare className="h-3.5 w-3.5" /> Post reply</Button>
            </div>
          </div>
        )}
      </div>
    </CardBody></Card>
  );
}
