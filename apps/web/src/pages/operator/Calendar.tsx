import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Ban, Trash2, Repeat } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Button, EmptyState, Badge, Modal, Input, Select } from '../../components/ui.js';
import { useStore, wt, remove } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, bookingsForFacility, spaceName } from '../../lib/selectors.js';
import { formatTime } from '../../lib/format.js';
import { genId } from '../../lib/ids.js';
import { leaseOccurrences } from '@sanctum/shared';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';

const SPACE_COLORS = ['bg-primary-100 text-primary-800', 'bg-gold/20 text-gold-dark', 'bg-success/15 text-success', 'bg-[#e0e3ff] text-primary-700', 'bg-warning/20 text-[#8a5a00]'];

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [cursor, setCursor] = useState(() => new Date());
  const [blockDay, setBlockDay] = useState<Date | null>(null);

  if (!facility) return <EmptyState title="No facility yet" />;
  const bookings = bookingsForFacility(data, facility.id).filter((b) => !['denied', 'cancelled'].includes(b.status));
  const spaces = data.spaces.filter((s) => s.facility_id === facility.id);
  const blocks = data.availability_blocks.filter((b) => b.facility_id === facility.id);
  const colorFor = (spaceId: string) => SPACE_COLORS[Math.max(0, spaces.findIndex((s) => s.id === spaceId)) % SPACE_COLORS.length];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const sameDay = (iso: string, date: Date) => {
    const s = new Date(iso);
    return s.getFullYear() === date.getFullYear() && s.getMonth() === date.getMonth() && s.getDate() === date.getDate();
  };

  // Recurring tenant/lease occurrences across the visible month (+/- a couple days).
  const winStart = new Date(year, month, -2);
  const winEnd = new Date(year, month + 1, 2);
  const leases = data.leases.filter((l) => l.facility_id === facility.id && l.status === 'active');
  const leaseOccs = leases.flatMap((l) =>
    leaseOccurrences(l, winStart, winEnd).map((o) => ({ ...o, title: l.title, space_id: l.space_id })),
  );

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Every approved and confirmed event, plus times you've blocked off."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBlockDay(new Date())}><Ban className="h-4 w-4" /> Block time</Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-36 text-center font-semibold">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {spaces.map((s) => <Badge key={s.id} className={colorFor(s.id)}>{s.name}</Badge>)}
        {blocks.length > 0 && <Badge tone="neutral"><Ban className="h-3 w-3" /> Blocked</Badge>}
        {leases.length > 0 && <Badge tone="primary"><Repeat className="h-3 w-3" /> Recurring tenants</Badge>}
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-black/5 bg-cream text-center text-xs font-semibold text-stone-warm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const isToday = date && new Date().toDateString() === date.toDateString();
            const events = date ? bookings.filter((b) => sameDay(b.start_time, date)) : [];
            const dayBlocks = date ? blocks.filter((b) => sameDay(b.start_time, date)) : [];
            const dayLeases = date ? leaseOccs.filter((o) => sameDay(o.start, date)) : [];
            return (
              <div key={i} className={cn('group min-h-24 border-b border-r border-black/5 p-1.5', !date && 'bg-black/[0.015]')}>
                {date && (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn('text-xs font-medium', isToday ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-white' : 'text-stone-warm')}>{date.getDate()}</span>
                      <button onClick={() => setBlockDay(date)} className="text-stone-warm opacity-0 transition group-hover:opacity-100" title="Block this day"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 2).map((e) => (
                        <button key={e.id} onClick={() => navigate(`/operator/bookings/${e.id}`)} className={cn('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium', colorFor(e.space_id))} title={`${e.event_name} · ${spaceName(data, e.space_id)}`}>
                          {formatTime(e.start_time)} {e.event_name}
                        </button>
                      ))}
                      {dayLeases.map((o, k) => (
                        <div key={`l${k}`} className="truncate rounded border border-dashed border-primary/40 bg-primary-50/50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700" title={`${o.title} (recurring)`}>
                          <Repeat className="mr-0.5 inline h-2.5 w-2.5" />{formatTime(o.start)} {o.title}
                        </div>
                      ))}
                      {dayBlocks.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-1 rounded bg-black/10 px-1.5 py-0.5 text-[11px] text-ink/60">
                          <span className="truncate"><Ban className="mr-0.5 inline h-2.5 w-2.5" />{b.reason || 'Blocked'}</span>
                          <button onClick={() => remove('availability_blocks', b.id)} className="hover:text-danger"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                      {events.length > 2 && <p className="px-1 text-[10px] text-stone-warm">+{events.length - 2} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {blockDay && <BlockModal facilityId={facility.id} spaces={spaces} day={blockDay} onClose={() => setBlockDay(null)} />}
    </div>
  );
}

function BlockModal({ facilityId, spaces, day, onClose }: { facilityId: string; spaces: import('@sanctum/shared').Space[]; day: Date; onClose: () => void }) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id || '');
  const [date, setDate] = useState(day.toISOString().slice(0, 10));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [reason, setReason] = useState('Internal event');
  const [busy, setBusy] = useState(false);

  async function block() {
    if (!spaceId) { toast.error('Choose a space'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await wt('availability_blocks', {
        id: genId('blk'), space_id: spaceId, facility_id: facilityId,
        start_time: new Date(`${date}T${start}:00`).toISOString(),
        end_time: new Date(`${date}T${end}:00`).toISOString(),
        reason: reason || null, created_at: now, updated_at: now,
      });
      toast.success('Time blocked off');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Block off time">
      <div className="space-y-3">
        <Select label="Space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="From" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="To" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance, holiday, internal event…" />
        <p className="text-xs text-stone-warm">Renters won't be able to book this space during the blocked time.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={block}>Block time</Button></div>
      </div>
    </Modal>
  );
}
