/** Client-side image processing + URL helpers. */
import { api } from './api.js';

const MAX_DIM = 1600;
const QUALITY = 0.82;
const MAX_BYTES = 25 * 1024 * 1024;

/** Resize/compress an image File to a JPEG data URL (≤1600px, q0.82, 25MB cap). */
export async function processImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('That image is larger than 25MB.');
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

/** Upload a data URL to R2; returns a servable URL, or the data URL if storage is off. */
export async function uploadDataUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append('file', blob, 'upload.jpg');
  try {
    const res = await api<{ url?: string; demo?: boolean }>('/upload', { body: form });
    return res.url || dataUrl;
  } catch {
    return dataUrl; // graceful: keep showing the local image
  }
}

/** Append a width param only for /api/files/ URLs (served as WebP via Images). */
export function thumb(url: string | null | undefined, width = 800): string {
  if (!url) return '';
  if (url.startsWith('/api/files/')) {
    return `${url}${url.includes('?') ? '&' : '?'}w=${width}`;
  }
  return url;
}
