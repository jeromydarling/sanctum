import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, ImagePlus, Trash2, Building2, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Badge, Input, Textarea, Select, Modal, EmptyState } from '../../components/ui.js';
import { SmartImage } from '../../components/SmartImage.js';
import { ImageStudio } from '../../components/ImageStudio.js';
import { AiDisclaimer } from '../../components/AiDisclaimer.js';
import { TranslationsEditor } from '../../components/TranslationsEditor.js';
import { useStore, wt, remove } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { callAI } from '../../lib/ai.js';
import {
  formatCents, parseDollarsToCents, SPACE_TYPES, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI,
  AMENITIES, AMENITY_LABELS, type Space, type Amenity, type Resource,
} from '@sanctum/shared';
import { cn } from '../../lib/cn.js';

export default function Spaces() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [editing, setEditing] = useState<Space | null>(null);
  const [creating, setCreating] = useState(false);

  if (!facility) return <EmptyState title="No facility yet" />;
  const spaces = data.spaces.filter((s) => s.facility_id === facility.id);
  const resources = data.resources.filter((r) => r.facility_id === facility.id);

  return (
    <div>
      <PageHeader title="Spaces & Resources" subtitle="The rooms you offer and the extras renters can add." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add space</Button>} />

      {spaces.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />} title="No spaces yet" body="Add your first space to start welcoming the community." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add a space</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="relative">
                <SmartImage src={s.images?.[0]} alt={s.name} emoji={SPACE_TYPE_EMOJI[s.space_type]} seed={s.id} className="h-40 w-full" />
                {!s.is_active && <span className="absolute left-2 top-2"><Badge tone="neutral">Hidden</Badge></span>}
              </div>
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge tone="gold">{SPACE_TYPE_LABELS[s.space_type]}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-warm">Up to {s.capacity_persons ?? '—'} · {formatCents(s.hourly_rate_cents)}/hr</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" full onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ResourcesSection facilityId={facility.id} resources={resources} />

      {(creating || editing) && (
        <SpaceEditor
          facilityId={facility.id}
          space={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SpaceEditor({ facilityId, space, onClose }: { facilityId: string; space: Space | null; onClose: () => void }) {
  const isNew = !space;
  const [form, setForm] = useState<Space>(space || blankSpace(facilityId));
  const [studioOpen, setStudioOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  function set<K extends keyof Space>(k: K, v: Space[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleAmenity(a: Amenity) {
    set('amenities', form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);
  }

  async function describe() {
    setAiBusy(true);
    const fallback = `${form.name} is a welcoming ${SPACE_TYPE_LABELS[form.space_type].toLowerCase()} with room for up to ${form.capacity_persons || 'your group'}. Thoughtfully maintained and ready for your next gathering.`;
    const text = await callAI('write-description', { name: form.name, space_type: form.space_type, capacity: form.capacity_persons, amenities: form.amenities.map((a) => AMENITY_LABELS[a as Amenity]).join(', ') }, fallback);
    set('description', text);
    setAiBusy(false);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Give your space a name'); return; }
    setBusy(true);
    try {
      await wt('spaces', form);
      toast.success(isNew ? 'Space added' : 'Space updated');
      onClose();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add a space' : 'Edit space'} size="lg">
      <div className="space-y-4">
        <div className="relative">
          <SmartImage src={form.images?.[0]} alt={form.name || 'space'} emoji={SPACE_TYPE_EMOJI[form.space_type]} seed={form.id} className="h-40 w-full rounded-card" />
          <Button size="sm" variant="outline" className="absolute bottom-2 right-2 bg-white" onClick={() => setStudioOpen(true)}><ImagePlus className="h-4 w-4" /> Image Studio</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Fellowship Hall" />
          <Select label="Type" value={form.space_type} onChange={(e) => set('space_type', e.target.value as Space['space_type'])}>
            {SPACE_TYPES.map((t) => <option key={t} value={t}>{SPACE_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
        <Select label="Pricing" value={form.pricing_mode || 'standard'} onChange={(e) => set('pricing_mode', e.target.value as Space['pricing_mode'])} hint="Rent at your listed rates, accept pay-what-you-can donations, or offer the space free to the community.">
          <option value="standard">Standard — listed rates</option>
          <option value="donation">Donation — pay what you can</option>
          <option value="free">Free for the community</option>
        </Select>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Description</span>
            <button onClick={describe} disabled={aiBusy} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Sparkles className="h-3.5 w-3.5" /> {aiBusy ? 'Writing…' : 'Write with AI'}
            </button>
          </div>
          <Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Describe the space…" />
          <div className="mt-1"><AiDisclaimer /></div>
          <div className="mt-3"><TranslationsEditor source={form.description || ''} value={form.translations} onChange={(t) => set('translations', t)} label="Translate this space" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Capacity" type="number" value={form.capacity_persons ?? ''} onChange={(e) => set('capacity_persons', e.target.value ? Number(e.target.value) : null)} />
          <Input label="Hourly rate ($)" defaultValue={form.hourly_rate_cents ? (form.hourly_rate_cents / 100).toString() : ''} onBlur={(e) => set('hourly_rate_cents', parseDollarsToCents(e.target.value))} placeholder="120" />
          <Input label="Deposit ($)" defaultValue={form.deposit_amount_cents ? (form.deposit_amount_cents / 100).toString() : ''} onBlur={(e) => set('deposit_amount_cents', parseDollarsToCents(e.target.value))} placeholder="250" />
          <Input label="Half-day ($)" defaultValue={form.half_day_rate_cents ? (form.half_day_rate_cents / 100).toString() : ''} onBlur={(e) => set('half_day_rate_cents', parseDollarsToCents(e.target.value) || null)} placeholder="400" />
          <Input label="Full-day ($)" defaultValue={form.full_day_rate_cents ? (form.full_day_rate_cents / 100).toString() : ''} onBlur={(e) => set('full_day_rate_cents', parseDollarsToCents(e.target.value) || null)} placeholder="700" />
          <Input label="Weekend hourly ($)" defaultValue={form.weekend_hourly_rate_cents ? (form.weekend_hourly_rate_cents / 100).toString() : ''} onBlur={(e) => set('weekend_hourly_rate_cents', parseDollarsToCents(e.target.value) || null)} placeholder="150" />
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium">Amenities</span>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <button key={a} onClick={() => toggleAmenity(a)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', form.amenities.includes(a) ? 'border-primary bg-primary-50 text-primary-700' : 'border-black/10 text-ink/70 hover:border-primary/30')}>
                {AMENITY_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active === 1} onChange={(e) => set('is_active', e.target.checked ? 1 : 0)} className="h-4 w-4 rounded" />
          Listed and bookable
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>{isNew ? 'Add space' : 'Save changes'}</Button>
        </div>
      </div>
      <ImageStudio open={studioOpen} onClose={() => setStudioOpen(false)} suggestedPrompt={`${form.name} — ${SPACE_TYPE_LABELS[form.space_type]}`} onApply={(url) => set('images', [url, ...form.images.filter((u) => u !== url)])} />
    </Modal>
  );
}

function ResourcesSection({ facilityId, resources }: { facilityId: string; resources: Resource[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');

  async function add() {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    await wt('resources', { id: genId('res'), facility_id: facilityId, name: name.trim(), resource_type: 'other', quantity: 1, hourly_rate_cents: 0, flat_rate_cents: parseDollarsToCents(rate), is_active: 1, created_at: now, updated_at: now });
    setName(''); setRate(''); setAdding(false);
    toast.success('Resource added');
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Resources & add-ons</h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      {resources.length === 0 ? (
        <p className="text-sm text-stone-warm">Tables, chairs, AV gear, and more that renters can add to a booking.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Card key={r.id}><CardBody className="flex items-center justify-between">
              <div><p className="font-medium">{r.name}</p><p className="text-xs text-stone-warm">{r.flat_rate_cents ? `${formatCents(r.flat_rate_cents)} flat` : 'Included'}</p></div>
              <button onClick={() => remove('resources', r.id)} className="text-stone-warm hover:text-danger"><Trash2 className="h-4 w-4" /></button>
            </CardBody></Card>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a resource">
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Round Tables (20)" />
          <Input label="Flat fee ($)" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="50" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={add}>Add</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function blankSpace(facilityId: string): Space {
  const now = new Date().toISOString();
  return {
    id: genId('spc'), facility_id: facilityId, name: '', space_type: 'fellowship_hall', description: '',
    capacity_persons: 50, square_footage: null, hourly_rate_cents: 10000, half_day_rate_cents: null,
    full_day_rate_cents: null, weekend_hourly_rate_cents: null, deposit_amount_cents: 0,
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], available_start_time: '07:00',
    available_end_time: '22:00', min_booking_hours: 1, max_booking_hours: null, buffer_minutes: 30,
    amenities: [], images: [], allowed_uses: [], restricted_uses: [], pricing_mode: 'standard', is_active: 1, created_at: now, updated_at: now,
  };
}
