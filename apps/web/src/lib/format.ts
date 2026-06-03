/** Display formatting helpers. */
import type { BookingStatus } from '@sanctum/shared';

export { formatCents } from '@sanctum/shared';

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`;
}

export function relativeDate(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

type Tone = 'neutral' | 'primary' | 'gold' | 'success' | 'warning' | 'danger';

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'primary' },
  denied: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  no_show: { label: 'No-show', tone: 'danger' },
};

export function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
