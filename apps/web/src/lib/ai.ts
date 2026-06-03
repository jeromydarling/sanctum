/** AI helpers. Falls back to a provided demo string when the worker signals demo. */
import { api } from './api.js';

/**
 * Call an AI text tool. CRITICAL: fall back when the worker returns {demo:true}
 * OR empty text. A plain `?? demoFallback` would let an empty string through —
 * the exact bug we will not reintroduce.
 */
export async function callAI(
  endpoint: string,
  body: Record<string, unknown>,
  demoFallback: string,
): Promise<string> {
  try {
    const data = await api<{ text?: string; demo?: boolean }>(`/ai/${endpoint}`, { body });
    return data.demo || !data.text?.trim() ? demoFallback : data.text;
  } catch {
    return demoFallback;
  }
}

/** Generate a Flux image (facilities/spaces only — no people). */
export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const data = await api<{ image?: string; demo?: boolean }>('/ai/image', { body: { prompt } });
    return data.demo || !data.image ? null : data.image;
  } catch {
    return null;
  }
}
