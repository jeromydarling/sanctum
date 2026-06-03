/** Image with a graceful gradient + emoji fallback so nothing renders broken. */
import { useState } from 'react';
import { cn } from '../lib/cn.js';
import { thumb } from '../lib/images.js';

const GRADIENTS = [
  'from-primary-500 to-primary-800',
  'from-gold to-gold-dark',
  'from-primary-400 to-gold',
  'from-primary-700 to-primary-900',
  'from-[#5b50ee] to-[#c9a84c]',
];

function pick(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function SmartImage({
  src, alt, emoji = '🏛️', seed, className, width = 800,
}: {
  src?: string | null;
  alt: string;
  emoji?: string;
  seed?: string;
  className?: string;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = src ? thumb(src, width) : null;

  if (!resolved || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br', pick(seed || alt), className)} aria-label={alt} role="img">
        <span className="text-4xl drop-shadow-sm sm:text-5xl">{emoji}</span>
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
