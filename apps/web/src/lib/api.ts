/** Thin fetch wrapper. Always uses explicit absolute /api paths. */
import { getToken } from './config.js';

export class ApiError extends Error {
  status: number;
  conflict: boolean;
  incidentId?: string;
  constructor(message: string, status: number, conflict = false, incidentId?: string) {
    super(message);
    this.status = status;
    this.conflict = conflict;
    this.incidentId = incidentId;
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  raw?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  });

  if (opts.raw) return res as unknown as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const d = (data || {}) as { error?: string; conflict?: boolean; incident_id?: string };
    throw new ApiError(d.error || `Request failed (${res.status})`, res.status, !!d.conflict, d.incident_id);
  }
  return data as T;
}
