/**
 * Lightweight US map — no third-party maps provider. Plots facility pins using
 * hardcoded state centroids on an equirectangular projection. Faint state labels
 * give geographic context.
 */
import { useState } from 'react';
import { cn } from '../lib/cn.js';

// Approximate [lat, lng] centroids for the lower 48 + AK/HI (placed in insets-ish).
const CENTROIDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [37.2, -119.4], CO: [39.0, -105.5],
  CT: [41.6, -72.7], DE: [39.0, -75.5], FL: [28.6, -82.4], GA: [32.6, -83.4], ID: [44.4, -114.6],
  IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.0, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3],
  LA: [31.0, -92.0], ME: [45.4, -69.2], MD: [39.0, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4],
  MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8],
  NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5],
  NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6],
  PA: [40.9, -77.8], RI: [41.7, -71.6], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4],
  TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.0, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.4],
  WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5],
};

const LNG_MIN = -125, LNG_MAX = -66, LAT_MIN = 24, LAT_MAX = 50;

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(4, Math.min(96, y)) };
}

export interface MapPin {
  id: string;
  state: string;
  label: string;
  count: number;
  onClick?: () => void;
}

export function UsMap({ pins }: { pins: MapPin[] }) {
  const [hover, setHover] = useState<string | null>(null);

  // Jitter multiple pins in the same state so they don't overlap exactly.
  const byState: Record<string, number> = {};

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-card border border-black/5 bg-gradient-to-br from-primary-50 to-cream">
      {/* faint state context labels */}
      {Object.entries(CENTROIDS).map(([abbr, [lat, lng]]) => {
        const { x, y } = project(lat, lng);
        return <span key={abbr} className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-medium text-ink/15" style={{ left: `${x}%`, top: `${y}%` }}>{abbr}</span>;
      })}

      {pins.map((p) => {
        const c = CENTROIDS[p.state?.toUpperCase()];
        if (!c) return null;
        const n = byState[p.state] = (byState[p.state] || 0) + 1;
        const offset = (n - 1) * 3.2;
        const { x, y } = project(c[0], c[1] + offset);
        return (
          <button
            key={p.id}
            onClick={p.onClick}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${x}%`, top: `${y}%`, zIndex: hover === p.id ? 20 : 10 }}
          >
            <span className="relative grid place-items-center">
              <span className={cn('grid h-7 min-w-7 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white shadow-lift ring-2 ring-white transition', hover === p.id && 'scale-110 bg-primary-700')}>{p.count}</span>
              <span className="h-2 w-2 -mt-0.5 rotate-45 bg-primary ring-2 ring-white" />
            </span>
            {hover === p.id && (
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-card bg-ink px-2 py-1 text-[11px] font-medium text-white shadow-lift">{p.label}</span>
            )}
          </button>
        );
      })}

      {pins.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-sm text-stone-warm">No spaces to map yet.</div>
      )}
    </div>
  );
}
