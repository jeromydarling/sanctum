import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, Button, EmptyState, Badge } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, bookingsForFacility, spaceName } from '../../lib/selectors.js';
import { formatTime } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const SPACE_COLORS = ['bg-primary-100 text-primary-800', 'bg-gold/20 text-gold-dark', 'bg-success/15 text-success', 'bg-[#e0e3ff] text-primary-700', 'bg-warning/20 text-[#8a5a00]'];

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [cursor, setCursor] = useState(() => new Date());

  if (!facility) return <EmptyState title="No facility yet" />;
  const bookings = bookingsForFacility(data, facility.id).filter((b) => !['denied', 'cancelled'].includes(b.status));
  const spaces = data.spaces.filter((s) => s.facility_id === facility.id);
  const colorFor = (spaceId: string) => SPACE_COLORS[Math.max(0, spaces.findIndex((s) => s.id === spaceId)) % SPACE_COLORS.length];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const byDay = (date: Date) => bookings.filter((b) => {
    const s = new Date(b.start_time);
    return s.getFullYear() === date.getFullYear() && s.getMonth() === date.getMonth() && s.getDate() === date.getDate();
  });

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Every approved and confirmed event, color-coded by space."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-36 text-center font-semibold">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {spaces.map((s) => <Badge key={s.id} className={colorFor(s.id)}>{s.name}</Badge>)}
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-black/5 bg-cream text-center text-xs font-semibold text-stone-warm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const isToday = date && new Date().toDateString() === date.toDateString();
            const events = date ? byDay(date) : [];
            return (
              <div key={i} className={cn('min-h-24 border-b border-r border-black/5 p-1.5', !date && 'bg-black/[0.015]')}>
                {date && (
                  <>
                    <div className={cn('mb-1 text-xs font-medium', isToday ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-white' : 'text-stone-warm')}>{date.getDate()}</div>
                    <div className="space-y-1">
                      {events.slice(0, 3).map((e) => (
                        <button key={e.id} onClick={() => navigate(`/operator/bookings/${e.id}`)} className={cn('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium', colorFor(e.space_id))} title={`${e.event_name} · ${spaceName(data, e.space_id)}`}>
                          {formatTime(e.start_time)} {e.event_name}
                        </button>
                      ))}
                      {events.length > 3 && <p className="px-1 text-[10px] text-stone-warm">+{events.length - 3} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
