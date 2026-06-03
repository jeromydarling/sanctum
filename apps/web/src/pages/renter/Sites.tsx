import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Globe, ExternalLink, Pencil, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Badge, EmptyState, Modal, Input, Select } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityName, spaceName } from '../../lib/selectors.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { slugify, type EventMicrosite } from '@sanctum/shared';

export default function Sites() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const sites = data.event_microsites.filter((s) => s.renter_id === user!.id);
  const myBookings = data.bookings.filter((b) => b.renter_id === user!.id);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Event pages" subtitle="Build a beautiful public page for your event — with an AI website builder." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New event page</Button>} />
      {sites.length === 0 ? (
        <EmptyState icon={<Globe className="h-8 w-8" />} title="No event pages yet" body="Create a shareable page for your event in seconds — invite guests, share the details, collect RSVPs." action={<Button onClick={() => setOpen(true)}><Sparkles className="h-4 w-4" /> Build one with AI</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <Card key={s.id}><CardBody>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <Badge tone={s.is_published ? 'success' : 'neutral'}>{s.is_published ? 'Published' : 'Draft'}</Badge>
              </div>
              <p className="mt-1 text-xs text-stone-warm">/e/{s.slug}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" full asLink={`/renter/sites/${s.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                {s.is_published === 1 && <Button size="sm" variant="ghost" asLink={`/e/${s.slug}`}><ExternalLink className="h-3.5 w-3.5" /></Button>}
              </div>
            </CardBody></Card>
          ))}
        </div>
      )}
      {open && <NewSiteModal renterId={user!.id} bookings={myBookings} dataFacilityName={(id) => facilityName(data, id)} dataSpaceName={(id) => spaceName(data, id)} existingSlugs={data.event_microsites.map((s) => s.slug)} onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewSiteModal({ renterId, bookings, dataFacilityName, dataSpaceName, existingSlugs, onClose }: {
  renterId: string; bookings: import('@sanctum/shared').Booking[];
  dataFacilityName: (id: string) => string; dataSpaceName: (id: string) => string;
  existingSlugs: string[]; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) { toast.error('Give your event page a title'); return; }
    setBusy(true);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      let slug = slugify(title);
      if (existingSlugs.includes(slug)) slug = `${slug}-${genId('x').slice(-4)}`;
      const now = new Date().toISOString();
      const site: EventMicrosite = {
        id: genId('site'), facility_id: booking?.facility_id || (bookings[0]?.facility_id ?? 'fac-usr-demo-operator'),
        renter_id: renterId, booking_id: bookingId || null, slug, title: title.trim(),
        content: {
          headline: title.trim(),
          date: booking ? new Date(booking.start_time).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : '',
          location: booking ? `${dataSpaceName(booking.space_id)}, ${dataFacilityName(booking.facility_id)}` : '',
          body: 'Tell your guests what to expect…', cta: 'RSVP', theme: 'indigo', cover: '',
        },
        is_published: 0, rsvp_enabled: 1, created_at: now, updated_at: now,
      };
      await wt('event_microsites', site);
      toast.success('Event page created');
      onClose();
      window.location.href = `/renter/sites/${site.id}`;
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="New event page">
      <div className="space-y-3">
        <Input label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spring Benefit Dinner" />
        {bookings.length > 0 && (
          <Select label="Link to a booking (optional)" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="">No linked booking</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{b.event_name}</option>)}
          </Select>
        )}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={create}>Create & edit</Button></div>
      </div>
    </Modal>
  );
}
