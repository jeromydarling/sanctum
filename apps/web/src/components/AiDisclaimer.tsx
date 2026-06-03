import { Sparkles } from 'lucide-react';

export function AiDisclaimer() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-stone-warm">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
      <span>AI-assisted. Please verify before relying on it — this is not legal or financial advice.</span>
    </p>
  );
}
