import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, Plus } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Badge, Button, EmptyState, Modal, Input, Select, Spinner } from '../../components/ui.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityName } from '../../lib/selectors.js';
import { formatDate } from '../../lib/format.js';
import { genId } from '../../lib/ids.js';
import { processImage, uploadDataUrl } from '../../lib/images.js';
import { notifyError } from '../../lib/errors.js';
import { parseDollarsToCents } from '@sanctum/shared';

export default function Documents() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const docs = data.compliance_docs.filter((c) => c.renter_id === user!.id);
  const myBookings = data.bookings.filter((b) => b.renter_id === user!.id);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader title="My documents" subtitle="Certificates of insurance and signed agreements." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Upload COI</Button>} />
      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents yet" body="Upload your certificate of insurance so hosts can approve your bookings faster." action={<Button onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> Upload COI</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id}><CardBody className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-card bg-primary-50 text-primary"><FileText className="h-5 w-5" /></span>
                <div>
                  <p className="font-medium">Certificate of Insurance</p>
                  <p className="text-sm text-stone-warm">{facilityName(data, d.facility_id)}</p>
                  {d.insurer_name && <p className="text-xs text-stone-warm">{d.insurer_name}{d.policy_number ? ` · #${d.policy_number}` : ''}</p>}
                  {d.expiration_date && <p className="text-xs text-stone-warm">Expires {formatDate(d.expiration_date)}</p>}
                </div>
              </div>
              <Badge tone={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}>{d.status}</Badge>
            </CardBody></Card>
          ))}
        </div>
      )}
      {open && <UploadModal renterId={user!.id} bookings={myBookings} dataFacilityName={(id: string) => facilityName(data, id)} onClose={() => setOpen(false)} />}
    </div>
  );
}

function UploadModal({ renterId, bookings, dataFacilityName, onClose }: { renterId: string; bookings: import('@sanctum/shared').Booking[]; dataFacilityName: (id: string) => string; onClose: () => void }) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id || '');
  const [insurer, setInsurer] = useState('');
  const [policy, setPolicy] = useState('');
  const [coverage, setCoverage] = useState('1000000');
  const [exp, setExp] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = file.type.startsWith('image/') ? await processImage(file) : await fileToDataUrl(file);
      const url = await uploadDataUrl(dataUrl);
      setFileUrl(url);
      toast.success('File attached');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); } finally { setUploading(false); }
  }

  async function submit() {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) { toast.error('Choose a booking'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await wt('compliance_docs', {
        id: genId('coi'), booking_id: bookingId, renter_id: renterId, facility_id: booking.facility_id,
        doc_type: 'certificate_of_insurance', file_url: fileUrl, status: 'pending', expiration_date: exp || null,
        insurer_name: insurer || null, policy_number: policy || null, coverage_amount_cents: parseDollarsToCents(coverage),
        notes: null, reviewed_by: null, uploaded_at: now, reviewed_at: null, updated_at: now,
      });
      toast.success('Insurance submitted for review');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Upload certificate of insurance">
      <div className="space-y-3">
        {bookings.length === 0 ? (
          <p className="text-sm text-stone-warm">You'll be able to upload a COI once you have a booking.</p>
        ) : (
          <>
            <Select label="For which booking?" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.event_name} · {dataFacilityName(b.facility_id)}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="Community Mutual" />
              <Input label="Policy #" value={policy} onChange={(e) => setPolicy(e.target.value)} />
              <Input label="Coverage ($)" value={coverage} onChange={(e) => setCoverage(e.target.value)} />
              <Input label="Expires" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-card border-2 border-dashed border-black/15 bg-cream py-6 text-sm font-medium hover:border-primary/40">
              {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {fileUrl ? 'File attached ✓ — replace' : 'Attach COI file (image or PDF)'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
            </label>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Submit</Button></div>
          </>
        )}
      </div>
    </Modal>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
