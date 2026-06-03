import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat, EmptyState } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator, spaceName } from '../../lib/selectors.js';
import { formatCents } from '../../lib/format.js';

const COLORS = ['#4338ca', '#c9a84c', '#5b50ee', '#2d6a4f', '#e9a825', '#a3a9ff'];

export default function Analytics() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  if (!facility) return <EmptyState title="No facility yet" />;
  const bookings = data.bookings.filter((b) => b.facility_id === facility.id && ['confirmed', 'completed', 'approved'].includes(b.status));

  // Revenue by month (last 6 months).
  const months: { label: string; revenue: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const revenue = bookings
      .filter((b) => { const s = new Date(b.start_time); return s.getMonth() === d.getMonth() && s.getFullYear() === d.getFullYear(); })
      .reduce((s, b) => s + b.subtotal_cents, 0) / 100;
    months.push({ label, revenue });
  }

  // Bookings by space.
  const bySpace = data.spaces.filter((s) => s.facility_id === facility.id).map((s) => ({
    name: spaceName(data, s.id), value: bookings.filter((b) => b.space_id === s.id).length,
  })).filter((x) => x.value > 0);

  const totalRevenue = bookings.reduce((s, b) => s + b.subtotal_cents, 0);
  const avgValue = bookings.length ? Math.round(totalRevenue / bookings.length) : 0;
  const utilization = Math.min(100, Math.round((bookings.length / Math.max(1, data.spaces.filter((s) => s.facility_id === facility.id).length * 20)) * 100));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How your spaces are serving the community." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total revenue" value={formatCents(totalRevenue)} tone="success" />
        <Stat label="Average booking" value={formatCents(avgValue)} />
        <Stat label="Utilization" value={`${utilization}%`} sub="of estimated capacity" tone="gold" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardBody>
          <h3 className="mb-4 font-semibold">Revenue (last 6 months)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0000000d" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8b8680' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#8b8680' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 8, border: '1px solid #0000000d' }} />
              <Bar dataKey="revenue" fill="#4338ca" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody></Card>

        <Card><CardBody>
          <h3 className="mb-4 font-semibold">Bookings by space</h3>
          {bySpace.length === 0 ? <p className="py-16 text-center text-sm text-stone-warm">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={bySpace} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {bySpace.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #0000000d' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardBody></Card>
      </div>
    </div>
  );
}
