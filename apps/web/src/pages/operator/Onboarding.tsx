import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Wand2, Plus, Trash2, ImagePlus, Globe, PartyPopper, Building2,
} from 'lucide-react';
import { Logo } from '../../components/Logo.js';
import { Card, CardBody, Button, Input, Textarea, Select, Spinner, Badge } from '../../components/ui.js';
import { SmartImage } from '../../components/SmartImage.js';
import { ImageStudio } from '../../components/ImageStudio.js';
import { AiDisclaimer } from '../../components/AiDisclaimer.js';
import { useStore, wt } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { api } from '../../lib/api.js';
import { callAI } from '../../lib/ai.js';
import { genId } from '../../lib/ids.js';
import { notifyError } from '../../lib/errors.js';
import { cn } from '../../lib/cn.js';
import {
  parseDollarsToCents, formatCents, SPACE_TYPES, SPACE_TYPE_LABELS, SPACE_TYPE_EMOJI,
  type Facility, type Space, type SpaceType,
} from '@sanctum/shared';

interface DraftSpace {
  id: string; name: string; space_type: SpaceType; capacity_persons: number; hourly_rate_cents: number; description: string;
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [step, setStep] = useState(0);

  const [fac, setFac] = useState<Facility | null>(facility || null);
  const [drafts, setDrafts] = useState<DraftSpace[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [importDesc, setImportDesc] = useState('');
  const [importing, setImporting] = useState(false);
  const [studio, setStudio] = useState(false);
  const [agreementBusy, setAgreementBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!fac) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  }
  function setF<K extends keyof Facility>(k: K, v: Facility[K]) { setFac((f) => (f ? { ...f, [k]: v } : f)); }

  async function runImport() {
    if (!importUrl.trim() && !importDesc.trim()) { toast.error('Add your website or a quick description'); return; }
    setImporting(true);
    try {
      const res = await api<{ suggestion: { description: string; denomination: string | null; spaces: DraftSpace[] }; demo?: boolean }>(
        '/ai/onboard', { body: { url: importUrl, description: importDesc, name: fac!.name } },
      );
      const s = res.suggestion;
      setF('description', s.description);
      if (s.denomination) setF('denomination', s.denomination);
      setDrafts(s.spaces.map((sp) => ({ ...sp, id: genId('spc') })));
      toast.success(`Drafted ${s.spaces.length} space${s.spaces.length !== 1 ? 's' : ''} for you`);
      setStep(1);
    } catch (e) { notifyError(e); } finally { setImporting(false); }
  }

  function addDraft() {
    setDrafts((d) => [...d, { id: genId('spc'), name: '', space_type: 'fellowship_hall', capacity_persons: 50, hourly_rate_cents: 8000, description: '' }]);
  }
  function updateDraft(id: string, patch: Partial<DraftSpace>) {
    setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function draftAgreement() {
    setAgreementBusy(true);
    const fallback = `FACILITY USE AGREEMENT\n\nThis agreement is between ${fac!.name} ("Host") and the Renter named in the booking.\n\n1. Permitted use. The space is rented solely for the event described in the booking.\n2. Care of the space. The Renter leaves the space clean and undamaged and is responsible for their guests.\n3. Insurance & liability. The Renter carries liability insurance where required and assumes responsibility for their event.\n4. Conduct. No unlawful, unsafe, or prohibited activities; the Host's posted rules apply.\n5. Payment & deposits. Fees and any refundable deposit are due per the booking.\n6. Cancellation. Per the Host's stated cancellation policy.`;
    const text = await callAI('generate-agreement', { facility_name: fac!.name, address: `${fac!.address}, ${fac!.city}, ${fac!.state}`, space_name: 'our spaces' }, fallback);
    setF('use_agreement_text', text);
    setAgreementBusy(false);
  }

  async function finish() {
    if (!fac!.name.trim() || !fac!.city.trim()) { toast.error('Add your community name and city'); setStep(1); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      // Let wt() manage updated_at (it uses the loaded value as the optimistic-
      // concurrency base). Overriding it here made the base never match the
      // stored row, so Publish 409'd for a fresh operator.
      await wt('facilities', { ...fac!, is_listed: 1 });
      for (const d of drafts) {
        if (!d.name.trim()) continue;
        const space: Space = {
          id: d.id, facility_id: fac!.id, name: d.name, space_type: d.space_type, description: d.description,
          capacity_persons: d.capacity_persons, square_footage: null, hourly_rate_cents: d.hourly_rate_cents,
          half_day_rate_cents: Math.round(d.hourly_rate_cents * 3.5) || null, full_day_rate_cents: Math.round(d.hourly_rate_cents * 6) || null,
          weekend_hourly_rate_cents: null, deposit_amount_cents: 0,
          available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], available_start_time: '07:00', available_end_time: '22:00',
          min_booking_hours: 1, max_booking_hours: null, buffer_minutes: 30, amenities: [], images: [],
          allowed_uses: [], restricted_uses: [], pricing_mode: 'standard', is_active: 1, created_at: now, updated_at: now,
        };
        await wt('spaces', space);
      }
      toast.success("You're all set — welcome to Sanctum!");
      navigate('/operator');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  }

  const steps = ['Quick start', 'Your community', 'Your spaces', 'Agreement', 'Done'];

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-black/5 bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <Logo />
          <button onClick={() => navigate('/operator')} className="text-sm text-stone-warm hover:text-ink">Skip for now</button>
        </div>
      </div>

      <div className="container-x max-w-3xl py-8">
        {/* progress */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-semibold', i < step ? 'bg-success text-white' : i === step ? 'bg-primary text-white' : 'bg-black/5 text-stone-warm')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className={cn('hidden text-sm sm:block', i === step ? 'font-semibold' : 'text-stone-warm')}>{s}</span>
              {i < steps.length - 1 && <span className="mx-1 hidden h-px w-5 bg-black/10 sm:block" />}
            </div>
          ))}
        </div>

        {/* STEP 0 — AI quick start */}
        {step === 0 && (
          <Card><CardBody className="space-y-4">
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-gold-light"><Wand2 className="h-7 w-7" /></span>
              <h1 className="mt-4 font-display text-2xl font-bold">Let's set you up in minutes</h1>
              <p className="mt-1 text-sm text-stone-warm">Paste your website and our AI drafts your whole listing — or describe your spaces in a sentence. You'll review everything next.</p>
            </div>
            <Input label="Your church or organization website (optional)" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://yourchurch.org" />
            <Textarea label="…or just describe what you have" value={importDesc} onChange={(e) => setImportDesc(e.target.value)} placeholder="We have a large fellowship hall, a commercial kitchen, three classrooms, and a gym." />
            <Button full loading={importing} onClick={runImport}><Sparkles className="h-4 w-4" /> Draft my listing with AI</Button>
            <AiDisclaimer />
            <button onClick={() => setStep(1)} className="block w-full text-center text-sm font-medium text-primary hover:underline">I'll set it up manually →</button>
          </CardBody></Card>
        )}

        {/* STEP 1 — community profile */}
        {step === 1 && (
          <Card><CardBody className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Your community</h1>
            <div className="relative">
              <SmartImage src={fac.cover_image_url} alt={fac.name} emoji="⛪" seed={fac.id} className="h-36 w-full rounded-card" width={1200} />
              <Button size="sm" variant="outline" className="absolute bottom-2 right-2 bg-white" onClick={() => setStudio(true)}><ImagePlus className="h-4 w-4" /> Cover</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={fac.name} onChange={(e) => setF('name', e.target.value)} />
              <Input label="Affiliation (optional)" value={fac.denomination || ''} onChange={(e) => setF('denomination', e.target.value)} />
              <Input label="City" value={fac.city} onChange={(e) => setF('city', e.target.value)} />
              <Input label="State" value={fac.state} onChange={(e) => setF('state', e.target.value)} />
              <Input label="Address" value={fac.address} onChange={(e) => setF('address', e.target.value)} />
              <Input label="Contact email" value={fac.email || ''} onChange={(e) => setF('email', e.target.value)} />
            </div>
            <Textarea label="About your community" value={fac.description || ''} onChange={(e) => setF('description', e.target.value)} placeholder="A warm welcome to your spaces…" />
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /> Back</Button><Button onClick={() => setStep(2)}>Continue <ArrowRight className="h-4 w-4" /></Button></div>
          </CardBody></Card>
        )}

        {/* STEP 2 — spaces */}
        {step === 2 && (
          <Card><CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold">Your spaces</h1>
              <Button size="sm" variant="outline" onClick={addDraft}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            {drafts.length === 0 ? (
              <div className="rounded-card border border-dashed border-black/10 py-10 text-center">
                <Building2 className="mx-auto h-8 w-8 text-stone-warm/60" />
                <p className="mt-2 text-sm text-stone-warm">Add your first space — a hall, classroom, kitchen, gym, or sanctuary.</p>
                <Button className="mt-3" size="sm" onClick={addDraft}><Plus className="h-4 w-4" /> Add a space</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map((d) => (
                  <div key={d.id} className="rounded-card border border-black/10 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input label="Name" value={d.name} onChange={(e) => updateDraft(d.id, { name: e.target.value })} placeholder="Fellowship Hall" />
                      <Select label="Type" value={d.space_type} onChange={(e) => updateDraft(d.id, { space_type: e.target.value as SpaceType })}>
                        {SPACE_TYPES.map((t) => <option key={t} value={t}>{SPACE_TYPE_LABELS[t]}</option>)}
                      </Select>
                      <Input label="Capacity" type="number" value={d.capacity_persons} onChange={(e) => updateDraft(d.id, { capacity_persons: Number(e.target.value) })} />
                      <Input label="Hourly rate ($)" defaultValue={(d.hourly_rate_cents / 100).toString()} onBlur={(e) => updateDraft(d.id, { hourly_rate_cents: parseDollarsToCents(e.target.value) })} />
                    </div>
                    <Textarea className="mt-3" value={d.description} onChange={(e) => updateDraft(d.id, { description: e.target.value })} placeholder="A short description…" />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-stone-warm">{SPACE_TYPE_EMOJI[d.space_type]} {formatCents(d.hourly_rate_cents)}/hr</span>
                      <button onClick={() => setDrafts((x) => x.filter((s) => s.id !== d.id))} className="text-stone-warm hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button><Button onClick={() => setStep(3)}>Continue <ArrowRight className="h-4 w-4" /></Button></div>
          </CardBody></Card>
        )}

        {/* STEP 3 — agreement */}
        {step === 3 && (
          <Card><CardBody className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Your use agreement</h1>
            <p className="text-sm text-stone-warm">Renters sign this when they book. We'll draft one you can edit — or add your own later.</p>
            <div className="flex justify-end">
              <button onClick={draftAgreement} disabled={agreementBusy} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Sparkles className="h-3.5 w-3.5" /> {agreementBusy ? 'Writing…' : 'Draft with AI'}</button>
            </div>
            <Textarea className="min-h-[200px] font-mono text-xs" value={fac.use_agreement_text || ''} onChange={(e) => setF('use_agreement_text', e.target.value)} placeholder="Your facility use agreement…" />
            <AiDisclaimer />
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button><Button onClick={() => setStep(4)}>Continue <ArrowRight className="h-4 w-4" /></Button></div>
          </CardBody></Card>
        )}

        {/* STEP 4 — done */}
        {step === 4 && (
          <Card><CardBody className="space-y-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><PartyPopper className="h-7 w-7" /></span>
            <h1 className="font-display text-2xl font-bold">You're ready to open your doors</h1>
            <p className="mx-auto max-w-md text-sm text-stone-warm">We'll publish your listing and your public page will be live at <span className="font-mono text-ink">sanctum.garden/c/{fac.slug}</span>. You can connect payouts and fine-tune anything from your dashboard.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge tone="primary"><Building2 className="h-3.5 w-3.5" /> {drafts.filter((d) => d.name.trim()).length} spaces</Badge>
              <Badge tone={fac.description ? 'success' : 'neutral'}><Check className="h-3.5 w-3.5" /> Profile</Badge>
              <Badge tone={fac.use_agreement_text ? 'success' : 'neutral'}><Check className="h-3.5 w-3.5" /> Agreement</Badge>
            </div>
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button size="lg" loading={busy} onClick={finish}><Globe className="h-4 w-4" /> Publish & go to dashboard</Button>
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
            </div>
          </CardBody></Card>
        )}
      </div>

      <ImageStudio open={studio} onClose={() => setStudio(false)} suggestedPrompt={`exterior of ${fac.name}, a welcoming community building`} onApply={(url) => setF('cover_image_url', url)} />
    </div>
  );
}
