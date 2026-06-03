import { Users, CalendarCheck, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Stat } from '../../components/ui.js';
import { useStore } from '../../lib/store.js';
import { formatCents } from '../../lib/format.js';

export default function AdminOverview() {
  const data = useStore((d) => d);
  const paidBookings = data.bookings.filter((b) => ['confirmed', 'completed'].includes(b.status));
  const gmv = paidBookings.reduce((s, b) => s + b.subtotal_cents, 0);
  const platformRevenue = paidBookings.reduce((s, b) => s + b.platform_fee_cents, 0);
  const subscriptionMrr = data.facilities.reduce((s, f) => s + ({ starter: 900, growth: 1900, pro: 2900 }[f.plan] || 0), 0);

  return (
    <div>
      <PageHeader title="Platform overview" subtitle="The whole network at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Facilities" value={data.facilities.length} sub="communities onboarded" tone="primary" />
        <Stat label="Total GMV" value={formatCents(gmv)} sub="value booked through Sanctum" tone="success" />
        <Stat label="Platform revenue" value={formatCents(platformRevenue)} sub="from 1.5% booking fees" tone="gold" />
        <Stat label="Subscription MRR" value={formatCents(subscriptionMrr)} sub={`${formatCents(subscriptionMrr * 12)} ARR`} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><CardBody className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-card bg-primary-50 text-primary"><Users className="h-5 w-5" /></span><div><p className="tabular text-xl font-bold">{data.profiles.length}</p><p className="text-xs text-stone-warm">total users</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-card bg-gold/15 text-gold-dark"><CalendarCheck className="h-5 w-5" /></span><div><p className="tabular text-xl font-bold">{data.bookings.length}</p><p className="text-xs text-stone-warm">bookings all-time</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-card bg-success/10 text-success"><TrendingUp className="h-5 w-5" /></span><div><p className="tabular text-xl font-bold">{data.spaces.length}</p><p className="text-xs text-stone-warm">spaces listed</p></div></CardBody></Card>
      </div>

      <Card className="mt-6"><CardBody>
        <h2 className="font-semibold">White-label & network licensing</h2>
        <p className="mt-1 text-sm text-stone-warm">One agreement can bring an entire diocese, denominational association, or municipal network onto Sanctum — hundreds of locations, a single relationship. This is the multi-stream model: transaction fees, subscriptions, and white-label licensing together.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">Transaction fee · 1.5%</span>
          <span className="rounded-full bg-gold/15 px-3 py-1 font-medium text-gold-dark">Subscriptions · $9–$29/mo</span>
          <span className="rounded-full bg-success/10 px-3 py-1 font-medium text-success">White-label · network deals</span>
        </div>
      </CardBody></Card>
    </div>
  );
}
