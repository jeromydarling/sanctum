import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Copy, FileText, DollarSign, ScrollText, Mail } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Input, Textarea, Spinner } from '../../components/ui.js';
import { AiDisclaimer } from '../../components/AiDisclaimer.js';
import { useStore } from '../../lib/store.js';
import { useAuth } from '../../lib/auth.js';
import { facilityForOperator } from '../../lib/selectors.js';
import { callAI } from '../../lib/ai.js';
import { cn } from '../../lib/cn.js';

type Tool = 'pricing-advice' | 'build-policy' | 'generate-agreement' | 'draft-email';

const TOOLS: { key: Tool; icon: typeof FileText; title: string; desc: string }[] = [
  { key: 'pricing-advice', icon: DollarSign, title: 'Pricing advisor', desc: 'Suggested rates based on your space and area.' },
  { key: 'build-policy', icon: ScrollText, title: 'Rental policy builder', desc: 'A complete, plain-language facility policy.' },
  { key: 'generate-agreement', icon: FileText, title: 'Use agreement', desc: 'A fair facility-use agreement you can adapt.' },
  { key: 'draft-email', icon: Mail, title: 'Email drafter', desc: 'Warm replies for approvals and declines.' },
];

export default function Assistant() {
  const { user } = useAuth();
  const data = useStore((d) => d);
  const facility = facilityForOperator(data, user!.id);
  const [tool, setTool] = useState<Tool>('pricing-advice');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  function f(k: string) { return fields[k] || ''; }
  function setF(k: string, v: string) { setFields((p) => ({ ...p, [k]: v })); }

  async function run() {
    setBusy(true);
    setOutput('');
    const fallbacks: Record<Tool, string> = {
      'pricing-advice': `For a ${f('space_type') || 'community hall'} in ${f('city') || 'your area'}, comparable spaces typically rent for $80–$150/hour, with half-day rates around $350–$500 and full days $600–$900. Nonprofits often receive 20–30% off. These are estimates — check two or three local spaces to calibrate.`,
      'build-policy': `# Facility Rental Policy\n\n**Welcome.** We're glad to share our space with the community.\n\n**Booking** — Requests are reviewed within 3 business days. A signed agreement and proof of insurance are required before your event.\n\n**Pricing & deposits** — Rates are listed per space. A refundable deposit secures your date.\n\n**Insurance** — Renters provide a certificate of insurance naming us as additional insured ($1M minimum).\n\n**Prohibited uses** — No activities that endanger guests or the building. \n\n**Cancellations** — Full refund up to 7 days before your event.`,
      'generate-agreement': `# Facility Use Agreement\n\nThis agreement is between ${facility?.name || 'the Facility'} ("Host") and the Renter for use of the named space.\n\n1. **Permitted use** — The space is rented for the stated event only.\n2. **Care of the space** — The Renter leaves the space clean and undamaged.\n3. **Insurance & liability** — The Renter carries liability insurance and assumes responsibility for their guests.\n4. **Payment** — Fees and any deposit are due per the booking.\n5. **Cancellation** — Per the Host's stated policy.\n\nSigned: ______________________   Date: __________`,
      'draft-email': `Hi ${f('renter_name') || 'there'},\n\nThank you for your interest in hosting "${f('event_name') || 'your event'}" with us. We're glad to let you know it's approved! Next, we'll just need your certificate of insurance and a signed use agreement, and then we'll confirm your date.\n\nWe're looking forward to welcoming you.\n\nWarmly,\n${facility?.name || 'The team'}`,
    };
    const text = await callAI(tool, { ...fields, kind: f('kind') || 'approval' }, fallbacks[tool]);
    setOutput(text);
    setBusy(false);
  }

  function copy() { navigator.clipboard.writeText(output); toast.success('Copied'); }

  return (
    <div>
      <PageHeader title="AI Assistant" subtitle="Helpful drafts for the paperwork — so you can focus on people." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          {TOOLS.map((t) => (
            <button key={t.key} onClick={() => { setTool(t.key); setOutput(''); }} className={cn('flex w-full items-start gap-3 rounded-card border p-3 text-left transition', tool === t.key ? 'border-primary bg-primary-50' : 'border-black/10 bg-white hover:border-primary/30')}>
              <t.icon className={cn('mt-0.5 h-5 w-5', tool === t.key ? 'text-primary' : 'text-stone-warm')} />
              <div><p className="text-sm font-semibold">{t.title}</p><p className="text-xs text-stone-warm">{t.desc}</p></div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          <Card><CardBody className="space-y-3">
            {tool === 'pricing-advice' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="City, State" value={f('city')} onChange={(e) => setF('city', e.target.value)} placeholder="Minneapolis, MN" />
                <Input label="Space type" value={f('space_type')} onChange={(e) => setF('space_type', e.target.value)} placeholder="fellowship hall" />
                <Input label="Capacity" value={f('capacity')} onChange={(e) => setF('capacity', e.target.value)} placeholder="200" />
                <Input label="Amenities" value={f('amenities')} onChange={(e) => setF('amenities', e.target.value)} placeholder="stage, kitchen, parking" />
              </div>
            )}
            {tool === 'build-policy' && (
              <div className="grid gap-3">
                <Input label="Events you welcome" value={f('welcomed')} onChange={(e) => setF('welcomed', e.target.value)} placeholder="weddings, meetings, concerts, classes" />
                <Input label="Events you restrict" value={f('restricted')} onChange={(e) => setF('restricted', e.target.value)} placeholder="for-profit sales, late-night events" />
              </div>
            )}
            {tool === 'generate-agreement' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Facility name" value={f('facility_name') || facility?.name || ''} onChange={(e) => setF('facility_name', e.target.value)} />
                <Input label="Address" value={f('address') || facility?.address || ''} onChange={(e) => setF('address', e.target.value)} />
                <Input label="Space name" value={f('space_name')} onChange={(e) => setF('space_name', e.target.value)} placeholder="Fellowship Hall" />
              </div>
            )}
            {tool === 'draft-email' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Renter name" value={f('renter_name')} onChange={(e) => setF('renter_name', e.target.value)} placeholder="Marcus" />
                <Input label="Event name" value={f('event_name')} onChange={(e) => setF('event_name', e.target.value)} placeholder="Spring Benefit" />
                <Input label="Kind (approval/denial)" value={f('kind')} onChange={(e) => setF('kind', e.target.value)} placeholder="approval" />
                <Input label="Context" value={f('context')} onChange={(e) => setF('context', e.target.value)} placeholder="we're excited to host" />
              </div>
            )}
            <Button onClick={run} loading={busy}><Sparkles className="h-4 w-4" /> Generate</Button>
            <AiDisclaimer />
          </CardBody></Card>

          {(busy || output) && (
            <Card className="mt-4"><CardBody>
              {busy ? <div className="flex items-center gap-2 text-sm text-stone-warm"><Spinner className="h-4 w-4" /> Thinking…</div> : (
                <>
                  <div className="mb-2 flex justify-end"><Button size="sm" variant="ghost" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy</Button></div>
                  <Textarea className="min-h-[280px] font-mono text-xs" value={output} onChange={(e) => setOutput(e.target.value)} />
                </>
              )}
            </CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}
