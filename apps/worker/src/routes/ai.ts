/**
 * AI proxy. Text tools prefer Anthropic (if ANTHROPIC_API_KEY present), else
 * Workers AI, else signal demo. Image generation uses Flux via the AI binding.
 * All calls are metered in D1 to cap spend.
 */
import { AI_DAILY_LIMIT_PER_USER, AI_DAILY_LIMIT_PER_IP } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, clientIP } from '../http.js';

const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';

interface ToolDef {
  system: string;
  build: (input: Record<string, unknown>) => string;
}

const TOOLS: Record<string, ToolDef> = {
  'generate-agreement': {
    system: 'You are a helpful assistant that drafts clear, fair facility-use agreements for community spaces. Use plain, accessible language. Output markdown.',
    build: (i) =>
      `Draft a facility use agreement for "${i.facility_name}" located at ${i.address}, for renting the space "${i.space_name}". Cover: permitted uses, hours, deposit and cancellation, insurance/liability, cleanup, conduct, and damages. Keep it warm but professional.`,
  },
  'pricing-advice': {
    system: 'You are a pricing advisor for community space rentals. Give concise, practical rate guidance with reasoning. Not financial advice.',
    build: (i) =>
      `Suggest hourly, half-day, and full-day rental rates for a ${i.space_type} space (capacity ${i.capacity}) in ${i.city}, ${i.state} with amenities: ${i.amenities}. Explain the reasoning briefly and note these are estimates.`,
  },
  'write-description': {
    system: 'You write warm, inviting, concise public descriptions of community spaces. 2-3 short paragraphs.',
    build: (i) =>
      `Write a compelling public-facing description for "${i.name}", a ${i.space_type} with capacity ${i.capacity} and amenities: ${i.amenities}.`,
  },
  'build-policy': {
    system: 'You draft clear community facility rental policies in plain language. Output markdown.',
    build: (i) =>
      `Draft a facility rental policy for a community organization that welcomes ${i.welcomed} and restricts ${i.restricted}. Cover pricing approach, insurance requirements, prohibited uses, deposits, and cancellation.`,
  },
  'check-suitability': {
    system: 'You help operators quickly triage rental requests. Respond with a recommendation (Approve / Review / Decline) and one short paragraph of reasoning.',
    build: (i) =>
      `An event request: type "${i.event_type}", expected attendance ${i.attendance}, description: "${i.description}". The space policy: "${i.policy}". Give a recommendation and reasoning.`,
  },
  'draft-email': {
    system: 'You draft warm, professional emails for community space operators. Keep them short and human.',
    build: (i) =>
      `Draft a ${i.kind} email to ${i.renter_name} regarding their event "${i.event_name}". ${i.context || ''}`,
  },
  'site-write': {
    system: 'You write warm, inviting copy for a community event web page. Return 2-3 short paragraphs of body copy only — no headline, no markdown headers.',
    build: (i) =>
      `Write inviting web-page body copy for an event called "${i.title}"${i.date ? `, happening ${i.date}` : ''}${i.location ? ` at ${i.location}` : ''}. ${i.notes || ''}`,
  },
  'site-command': {
    system: 'You revise event web-page body copy according to an instruction. Return ONLY the revised body copy, no preamble, no quotes.',
    build: (i) =>
      `Current copy:\n"""\n${i.current}\n"""\n\nInstruction: ${i.instruction}\n\nReturn the full revised copy.`,
  },
  'learning': {
    system: 'You are a friendly guide who explains community-facility-rental topics (insurance, permitting, agreements, safety) in plain language. Be practical and concise. Always remind the reader to verify with local authorities.',
    build: (i) => `${i.question}`,
  },
};

export async function handleAITool(
  env: Env,
  req: Request,
  auth: AuthContext | null,
  tool: string,
): Promise<Response> {
  const def = TOOLS[tool];
  if (!def) return err('Unknown AI tool', 404);

  const ip = clientIP(req);
  const gate = await meter(env, auth?.id || null, ip, tool);
  if (!gate.ok) return json({ demo: true, limited: true, reason: gate.reason });

  const input = await readJson<Record<string, unknown>>(req);
  const prompt = def.build(input);

  // Prefer Anthropic if configured.
  if (env.ANTHROPIC_API_KEY) {
    try {
      const text = await anthropic(env, def.system, prompt);
      if (text?.trim()) return json({ text });
    } catch (e) {
      console.error('[ai:anthropic]', e);
    }
  }

  // Fall back to Workers AI.
  if (env.AI) {
    try {
      const res = (await env.AI.run(TEXT_MODEL, {
        messages: [
          { role: 'system', content: def.system },
          { role: 'user', content: prompt },
        ],
      })) as { response?: string };
      const text = res.response?.trim();
      if (text) return json({ text });
    } catch (e) {
      console.error('[ai:workers]', e);
    }
  }

  return json({ demo: true });
}

/** POST /api/ai/image { prompt } -> Flux image (facilities/spaces only, no people). */
export async function handleAIImage(
  env: Env,
  req: Request,
  auth: AuthContext | null,
): Promise<Response> {
  const ip = clientIP(req);
  const gate = await meter(env, auth?.id || null, ip, 'image');
  if (!gate.ok) return json({ demo: true, limited: true });

  const { prompt } = await readJson<{ prompt?: string }>(req);
  if (!prompt?.trim()) return err('A prompt is required', 422);
  if (!env.AI) return json({ demo: true });

  const safePrompt =
    `Architectural interior/exterior photograph of ${prompt}. ` +
    `Empty space, no people, no figures. Warm natural light, inviting, high quality.`;

  try {
    const res = (await env.AI.run(FLUX_MODEL, { prompt: safePrompt })) as { image?: string };
    if (res.image) {
      return json({ image: `data:image/jpeg;base64,${res.image}` });
    }
    return json({ demo: true });
  } catch (e) {
    console.error('[ai:flux]', e);
    return json({ demo: true });
  }
}

async function anthropic(env: Env, system: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.map((c) => c.text || '').join('') || '';
}

async function meter(
  env: Env,
  userId: string | null,
  ip: string,
  endpoint: string,
): Promise<{ ok: boolean; reason?: string }> {
  const day = new Date().toISOString().slice(0, 10);
  if (userId) {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND day = ?',
    ).bind(userId, day).first<{ n: number }>();
    if ((row?.n || 0) >= AI_DAILY_LIMIT_PER_USER) {
      return { ok: false, reason: 'daily user limit reached' };
    }
  }
  const ipRow = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM ai_usage WHERE ip = ? AND day = ?',
  ).bind(ip, day).first<{ n: number }>();
  if ((ipRow?.n || 0) >= AI_DAILY_LIMIT_PER_IP && !userId) {
    return { ok: false, reason: 'daily IP limit reached' };
  }

  await env.DB.prepare(
    'INSERT INTO ai_usage (id, user_id, ip, endpoint, day) VALUES (?, ?, ?, ?, ?)',
  ).bind(genId('aiu'), userId, ip, endpoint, day).run();
  return { ok: true };
}
