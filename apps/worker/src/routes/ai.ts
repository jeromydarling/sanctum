/**
 * AI proxy — 100% Cloudflare Workers AI. Text tools run a Llama instruct model
 * (with a fast fallback), image generation uses Flux via the AI binding, and all
 * calls are metered in D1 to cap spend. Returns {demo:true} when AI is absent.
 */
import { AI_DAILY_LIMIT_PER_USER, AI_DAILY_LIMIT_PER_IP } from '@sanctum/shared';
import type { Env, AuthContext } from '../types.js';
import { json, err, readJson, genId, clientIP } from '../http.js';

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const TEXT_MODEL_FALLBACK = '@cf/meta/llama-3.1-8b-instruct-fast';
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
  'translate': {
    system: 'You are a careful, faithful translator. Translate the user\'s text into the requested language, preserving tone and meaning. Return ONLY the translated text — no preamble, no notes, no quotation marks.',
    build: (i) => `Translate the following into ${i.target_language}:\n\n${i.text}`,
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

  // 100% Cloudflare Workers AI (primary model, with a fast fallback on error).
  if (env.AI) {
    const text = await runText(env, def.system, prompt);
    if (text) return json({ text });
  }

  return json({ demo: true });
}

/** Run a Workers AI chat model; tries the primary model then a fast fallback. */
/** POST /api/ai/translate-batch { texts: string[], target_language } — one metered
 *  call translates many strings (model runs N times server-side; meter counts once). */
export async function handleTranslateBatch(env: Env, req: Request, auth: AuthContext | null): Promise<Response> {
  const ip = clientIP(req);
  const gate = await meter(env, auth?.id || null, ip, 'translate');
  if (!gate.ok) return json({ demo: true, limited: true });

  const body = await readJson<{ texts?: string[]; target_language?: string }>(req);
  const texts = Array.isArray(body.texts) ? body.texts.slice(0, 15) : [];
  const lang = (body.target_language || '').trim();
  if (!texts.length || !lang) return json({ translations: texts });
  if (!env.AI) return json({ translations: texts, demo: true });

  const system = "You are a careful, faithful translator. Translate the user's text into the requested language, preserving tone and meaning. Return ONLY the translated text — no preamble, no notes, no quotation marks.";
  const out: string[] = [];
  for (const t of texts) {
    const text = (t || '').slice(0, 2000);
    if (!text.trim()) { out.push(t); continue; }
    const translated = await runText(env, system, `Translate the following into ${lang}:\n\n${text}`);
    out.push(translated?.trim() || t);
  }
  return json({ translations: out });
}

async function runText(env: Env, system: string, prompt: string): Promise<string | null> {
  for (const model of [TEXT_MODEL, TEXT_MODEL_FALLBACK]) {
    try {
      const res = (await env.AI!.run(model, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
      })) as { response?: string };
      const text = res.response?.trim();
      if (text) return text;
    } catch (e) {
      console.error(`[ai:workers:${model}]`, e);
    }
  }
  return null;
}

interface OnboardSuggestion {
  description: string;
  denomination: string | null;
  spaces: { name: string; space_type: string; capacity_persons: number; hourly_rate_cents: number; description: string }[];
}

const SPACE_TYPE_HINTS: Record<string, string> = {
  hall: 'fellowship_hall', fellowship: 'fellowship_hall', gym: 'gym', gymnasium: 'gym',
  sanctuary: 'sanctuary', chapel: 'chapel', classroom: 'classroom', class: 'classroom',
  kitchen: 'kitchen', nursery: 'nursery', parking: 'parking', lot: 'parking',
  office: 'office', room: 'office', outdoor: 'outdoor', field: 'outdoor', lawn: 'outdoor',
};

/** POST /api/ai/onboard { url?, description?, name? } -> a draft listing the operator reviews. */
export async function handleOnboard(env: Env, req: Request, auth: AuthContext | null): Promise<Response> {
  const ip = clientIP(req);
  const gate = await meter(env, auth?.id || null, ip, 'onboard');
  if (!gate.ok) return json({ demo: true, limited: true });

  const body = await readJson<{ url?: string; description?: string; name?: string }>(req);
  let context = (body.description || '').slice(0, 4000);

  // If a website URL is given, fetch and strip it to plain text for context.
  if (body.url && /^https?:\/\//i.test(body.url)) {
    try {
      const res = await fetch(body.url, { headers: { 'User-Agent': 'SanctumBot/1.0' } });
      if (res.ok) {
        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z]+;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        context = `${context}\n\nWebsite content:\n${text}`.slice(0, 6000);
      }
    } catch { /* ignore fetch errors, fall back to description */ }
  }

  const fallback = heuristicOnboard(body.name || 'Your Community', context);

  if (!env.AI) return json({ suggestion: fallback, demo: true });

  const system = 'You help a community building list its rentable spaces. Given notes about an organization, respond with ONLY a JSON object (no prose, no markdown) of the form: {"description": string, "denomination": string|null, "spaces": [{"name": string, "space_type": one of ["sanctuary","fellowship_hall","classroom","kitchen","gym","outdoor","parking","office","nursery","chapel","other"], "capacity_persons": number, "hourly_rate_cents": number, "description": string}]}. Suggest 2-5 realistic spaces with sensible US rental rates in cents. The description is a warm 2-3 sentence public intro.';
  const prompt = `Organization name: ${body.name || 'Unknown'}\nNotes: ${context || 'A community building with spaces to rent.'}`;
  const raw = await runText(env, system, prompt);
  const parsed = raw ? safeParseOnboard(raw) : null;
  return json({ suggestion: parsed || fallback });
}

function safeParseOnboard(raw: string): OnboardSuggestion | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Partial<OnboardSuggestion>;
    if (!Array.isArray(obj.spaces)) return null;
    const valid = ['sanctuary', 'fellowship_hall', 'classroom', 'kitchen', 'gym', 'outdoor', 'parking', 'office', 'nursery', 'chapel', 'other'];
    return {
      description: String(obj.description || '').slice(0, 800),
      denomination: obj.denomination ? String(obj.denomination).slice(0, 80) : null,
      spaces: obj.spaces.slice(0, 6).map((s) => ({
        name: String(s.name || 'Space').slice(0, 80),
        space_type: valid.includes(String(s.space_type)) ? String(s.space_type) : 'other',
        capacity_persons: Math.max(1, Math.min(5000, Math.round(Number(s.capacity_persons) || 30))),
        hourly_rate_cents: Math.max(0, Math.min(500000, Math.round(Number(s.hourly_rate_cents) || 5000))),
        description: String(s.description || '').slice(0, 400),
      })),
    };
  } catch {
    return null;
  }
}

/** Deterministic fallback when AI is unavailable: infer spaces from keywords. */
function heuristicOnboard(name: string, context: string): OnboardSuggestion {
  const lower = context.toLowerCase();
  const found = new Map<string, string>();
  for (const [kw, type] of Object.entries(SPACE_TYPE_HINTS)) {
    if (lower.includes(kw) && !found.has(type)) found.set(type, kw);
  }
  if (found.size === 0) {
    found.set('fellowship_hall', 'hall');
    found.set('classroom', 'classroom');
  }
  const defaults: Record<string, { cap: number; rate: number; label: string; desc: string }> = {
    fellowship_hall: { cap: 150, rate: 10000, label: 'Fellowship Hall', desc: 'A spacious hall for receptions, dinners, and community gatherings.' },
    sanctuary: { cap: 200, rate: 12000, label: 'Sanctuary', desc: 'A beautiful space for ceremonies, concerts, and services.' },
    chapel: { cap: 60, rate: 8000, label: 'Chapel', desc: 'An intimate space with warm light and fine acoustics.' },
    classroom: { cap: 25, rate: 3500, label: 'Classroom', desc: 'A flexible room for classes, meetings, and workshops.' },
    kitchen: { cap: 10, rate: 7000, label: 'Commercial Kitchen', desc: 'A well-equipped kitchen for meal programs and catering prep.' },
    gym: { cap: 120, rate: 9000, label: 'Gymnasium', desc: 'A full-size gym for sports, expos, and large events.' },
    outdoor: { cap: 200, rate: 6000, label: 'Outdoor Space', desc: 'An open green space for picnics, markets, and celebrations.' },
    parking: { cap: 100, rate: 3000, label: 'Parking Lot', desc: 'Ample parking available to rent for events and overflow.' },
    office: { cap: 12, rate: 3000, label: 'Meeting Room', desc: 'A quiet room for small meetings and gatherings.' },
    nursery: { cap: 15, rate: 2500, label: 'Nursery', desc: 'A safe, cheerful room for the littlest guests.' },
  };
  const spaces = [...found.keys()].slice(0, 5).map((type) => {
    const d = defaults[type] || { cap: 30, rate: 5000, label: 'Space', desc: 'A welcoming community space.' };
    return { name: d.label, space_type: type, capacity_persons: d.cap, hourly_rate_cents: d.rate, description: d.desc };
  });
  return {
    description: `${name} is a community space opening its doors to the neighborhood — with welcoming rooms for gatherings, classes, celebrations, and the work of building community together.`,
    denomination: null,
    spaces,
  };
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
