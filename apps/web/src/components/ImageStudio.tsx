/** Image Studio: generate Flux variations, upload, or paste a URL; apply on confirm. */
import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Upload, Link2, Check } from 'lucide-react';
import { Modal, Button, Input, Spinner } from './ui.js';
import { AiDisclaimer } from './AiDisclaimer.js';
import { generateImage } from '../lib/ai.js';
import { processImage, uploadDataUrl } from '../lib/images.js';
import { cn } from '../lib/cn.js';

export function ImageStudio({
  open, onClose, onApply, suggestedPrompt,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (url: string) => void;
  suggestedPrompt?: string;
}) {
  const [tab, setTab] = useState<'generate' | 'upload' | 'url'>('generate');
  const [prompt, setPrompt] = useState(suggestedPrompt || '');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const img = await generateImage(prompt);
      if (img) {
        setCandidates((c) => [img, ...c].slice(0, 6));
        setSelected(img);
      } else {
        toast.info('Image generation is in demo mode — upload or paste a URL instead.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await processImage(file);
      setSelected(dataUrl);
      setCandidates((c) => [dataUrl, ...c].slice(0, 6));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process image');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const chosen = tab === 'url' ? urlInput.trim() : selected;
    if (!chosen) { toast.error('Choose or create an image first'); return; }
    setBusy(true);
    try {
      const finalUrl = chosen.startsWith('data:') ? await uploadDataUrl(chosen) : chosen;
      onApply(finalUrl);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Image Studio" size="lg">
      <div className="mb-4 inline-flex rounded-card border border-black/10 bg-white p-1">
        {[{ k: 'generate', icon: Sparkles, l: 'Generate' }, { k: 'upload', icon: Upload, l: 'Upload' }, { k: 'url', icon: Link2, l: 'Paste URL' }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as typeof tab)} className={cn('flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm font-medium', tab === t.k ? 'bg-primary text-white' : 'text-ink/70')}>
            <t.icon className="h-4 w-4" /> {t.l}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="space-y-3">
          <Input label="Describe the space" placeholder="a sunlit fellowship hall with hardwood floors and round tables" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button onClick={generate} loading={busy}><Sparkles className="h-4 w-4" /> Generate variations</Button>
          <p className="text-xs text-stone-warm">Images depict spaces only — never people.</p>
          <AiDisclaimer />
        </div>
      )}
      {tab === 'upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-black/15 bg-cream py-10 text-center hover:border-primary/40">
          {busy ? <Spinner /> : <Upload className="h-7 w-7 text-stone-warm" />}
          <span className="mt-2 text-sm font-medium">Click to upload</span>
          <span className="text-xs text-stone-warm">Resized automatically · up to 25MB</span>
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      )}
      {tab === 'url' && (
        <Input label="Image URL" placeholder="https://…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
      )}

      {candidates.length > 0 && tab !== 'url' && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {candidates.map((c, i) => (
            <button key={i} onClick={() => setSelected(c)} className={cn('relative aspect-video overflow-hidden rounded-card border-2', selected === c ? 'border-primary' : 'border-transparent')}>
              <img src={c} alt="candidate" className="h-full w-full object-cover" />
              {selected === c && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><Check className="h-3 w-3" /></span>}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={apply} loading={busy}>Apply image</Button>
      </div>
    </Modal>
  );
}
