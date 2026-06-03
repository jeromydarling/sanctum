import { useState } from 'react';
import { GraduationCap, ShieldCheck, FileSignature, ClipboardCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/dash/DashShell.js';
import { Card, CardBody, Button, Spinner } from '../../components/ui.js';
import { AiDisclaimer } from '../../components/AiDisclaimer.js';
import { callAI } from '../../lib/ai.js';
import { cn } from '../../lib/cn.js';

const GUIDES = [
  { icon: ShieldCheck, title: 'Certificates of insurance', body: 'Most spaces ask renters to carry liability insurance (often $1M) and name the host as additional insured. A one-day event policy is usually inexpensive — ask your insurer or an event-insurance marketplace.' },
  { icon: FileSignature, title: 'Facility use agreements', body: 'This is the contract between you and the host: what you can do, hours, cleanup, deposits, and who\'s responsible if something goes wrong. Read it fully and keep a copy.' },
  { icon: ClipboardCheck, title: 'Permits & occupancy', body: 'Large gatherings, amplified sound, or serving food may need local permits. Check your city or county, and confirm the room\'s posted occupancy limit before you sell tickets.' },
];

const SUGGESTED = [
  'Do I need event insurance for a 60-person birthday party?',
  'What should a facility use agreement include?',
  'How do I figure out the occupancy limit for a hall?',
];

export default function Learn() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(q?: string) {
    const query = q || question;
    if (!query.trim()) return;
    setQuestion(query);
    setBusy(true);
    setAnswer('');
    const fallback = `Great question. In general: confirm what the host requires in writing, check whether your activity needs a local permit, and make sure any insurance names the host as additional insured. Rules vary by city and venue, so verify the specifics with the host and your local authority before your event.`;
    const text = await callAI('learning', { question: query }, fallback);
    setAnswer(text);
    setBusy(false);
  }

  return (
    <div>
      <PageHeader title="Learning hub" subtitle="Plain-language guidance for renting community spaces with confidence." />
      <div className="grid gap-4 sm:grid-cols-3">
        {GUIDES.map((g) => (
          <Card key={g.title}><CardBody>
            <span className="grid h-11 w-11 place-items-center rounded-card bg-primary-50 text-primary"><g.icon className="h-5 w-5" /></span>
            <h3 className="mt-3 font-semibold">{g.title}</h3>
            <p className="mt-1 text-sm text-stone-warm">{g.body}</p>
          </CardBody></Card>
        ))}
      </div>

      <Card className="mt-6"><CardBody className="space-y-3">
        <div className="flex items-center gap-2 font-semibold"><GraduationCap className="h-5 w-5 text-primary" /> Ask anything</div>
        <div className="flex gap-2">
          <input className="input-base flex-1" placeholder="Ask about insurance, permits, agreements…" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <Button onClick={() => ask()} loading={busy}><Sparkles className="h-4 w-4" /> Ask</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} className={cn('rounded-full border border-black/10 px-3 py-1 text-xs text-ink/70 hover:border-primary/40 hover:text-primary')}>{s}</button>
          ))}
        </div>
        {(busy || answer) && (
          <div className="rounded-card bg-cream p-4">
            {busy ? <div className="flex items-center gap-2 text-sm text-stone-warm"><Spinner className="h-4 w-4" /> Thinking…</div> : <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{answer}</p>}
          </div>
        )}
        <AiDisclaimer />
      </CardBody></Card>
    </div>
  );
}
