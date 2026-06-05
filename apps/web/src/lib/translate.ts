/** Client-side translation helpers (Cloudflare Workers AI / Llama, batched). */
import { api } from './api.js';

export const LANGS: { label: string; name: string }[] = [
  { label: 'English', name: 'English' },
  { label: 'Español', name: 'Spanish' },
  { label: 'Français', name: 'French' },
  { label: 'Tiếng Việt', name: 'Vietnamese' },
  { label: 'Tagalog', name: 'Tagalog' },
  { label: '한국어', name: 'Korean' },
  { label: '中文', name: 'Chinese (Simplified)' },
  { label: 'Português', name: 'Portuguese' },
  { label: 'Kreyòl', name: 'Haitian Creole' },
  { label: 'العربية', name: 'Arabic' },
];

export const RTL_LANGS = new Set(['Arabic']);

/** Translate many strings in a single metered request. Returns originals on failure. */
export async function translateBatch(texts: string[], language: string): Promise<string[]> {
  if (language === 'English' || texts.length === 0) return texts;
  try {
    const r = await api<{ translations?: string[] }>('/ai/translate-batch', {
      auth: false,
      body: { texts, target_language: language },
    });
    return r.translations && r.translations.length === texts.length ? r.translations : texts;
  } catch {
    return texts;
  }
}
