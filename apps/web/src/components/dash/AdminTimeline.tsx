/** Platform CRM timeline for the super-admin customer area — notes, calls,
 *  emails, and follow-up tasks on a customer (operator). Backed by admin_notes. */
import { useState } from 'react';
import { toast } from 'sonner';
import { StickyNote, Phone, Mail, ListTodo, Plus, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Card, CardBody, Button, Badge, Textarea, Input } from '../ui.js';
import { useStore, wt, remove } from '../../lib/store.js';
import { formatDate } from '../../lib/format.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import type { AdminNote } from '@sanctum/shared';

const KIND_META: Record<AdminNote['kind'], { icon: typeof StickyNote; label: string; tone: string }> = {
  note: { icon: StickyNote, label: 'Note', tone: 'bg-primary-50 text-primary-700' },
  call: { icon: Phone, label: 'Call', tone: 'bg-gold/15 text-gold-dark' },
  email: { icon: Mail, label: 'Email', tone: 'bg-[#e0e3ff] text-primary-700' },
  task: { icon: ListTodo, label: 'Task', tone: 'bg-warning/15 text-[#8a5a00]' },
};

/** Count of open follow-up tasks for a customer (for the list "needs attention" flag). */
export function openTasks(d: { admin_notes: AdminNote[] }, subjectId: string): number {
  return d.admin_notes.filter((t) => t.subject_id === subjectId && t.kind === 'task' && !t.done).length;
}

export function AdminTimeline({ subjectId, userId }: { subjectId: string; userId: string }) {
  const items = useStore((d) => d.admin_notes
    .filter((t) => t.subject_kind === 'operator' && t.subject_id === subjectId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
  const now = new Date();

  return (
    <div className="space-y-5">
      <Composer subjectId={subjectId} userId={userId} />
      <Card><CardBody>
        <h2 className="font-semibold">Customer history</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-stone-warm">No history yet — log your first call, email, or note above.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {items.map((t) => {
              const meta = KIND_META[t.kind];
              const overdue = t.kind === 'task' && !t.done && t.due_at && new Date(t.due_at) < now;
              return (
                <li key={t.id} className="flex gap-3">
                  <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', meta.tone)}><meta.icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-warm">{meta.label}</span>
                      <span className="text-xs text-stone-warm">{formatDate(t.created_at)}</span>
                      {overdue && <Badge tone="danger"><AlertCircle className="h-3 w-3" /> overdue</Badge>}
                    </div>
                    <p className={cn('mt-0.5 text-sm', t.done === 1 && 'text-stone-warm line-through')}>{t.body}</p>
                    {t.kind === 'task' && t.due_at && <p className="mt-0.5 text-xs text-stone-warm">Due {formatDate(t.due_at)}</p>}
                    <div className="mt-1 flex items-center gap-3">
                      {t.kind === 'task' && (
                        <button onClick={() => wt('admin_notes', { ...t, done: t.done ? 0 : 1 })} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          {t.done ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />} {t.done ? 'Reopen' : 'Done'}
                        </button>
                      )}
                      <button onClick={() => remove('admin_notes', t.id)} className="text-xs text-stone-warm hover:text-danger">Remove</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody></Card>
    </div>
  );
}

function Composer({ subjectId, userId }: { subjectId: string; userId: string }) {
  const [kind, setKind] = useState<AdminNote['kind']>('note');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) { toast.error('Add a few words'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await wt('admin_notes', {
        id: genId('an'), subject_kind: 'operator', subject_id: subjectId,
        kind, body: body.trim(), due_at: kind === 'task' && due ? new Date(`${due}T12:00:00`).toISOString() : null,
        done: 0, created_by: userId, created_at: now, updated_at: now,
      });
      setBody(''); setDue('');
      toast.success('Logged');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Card><CardBody className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_META) as AdminNote['kind'][]).map((k) => {
          const meta = KIND_META[k];
          return (
            <button key={k} onClick={() => setKind(k)} className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition', kind === k ? 'border-primary bg-primary-50 text-primary-700' : 'border-black/10 text-ink/70 hover:border-primary/30')}>
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === 'task' ? 'What needs following up?' : kind === 'call' ? 'What did you discuss?' : 'Log a note about this customer…'} />
      <div className="flex items-center justify-between gap-3">
        {kind === 'task' ? <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="max-w-44" /> : <span />}
        <Button loading={busy} onClick={add}><Plus className="h-4 w-4" /> Add {KIND_META[kind].label.toLowerCase()}</Button>
      </div>
    </CardBody></Card>
  );
}
