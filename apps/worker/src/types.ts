import type { Role } from '@sanctum/shared';

export interface Env {
  DB: D1Database;
  AI?: Ai;
  STORAGE?: R2Bucket;
  IMAGES?: ImagesBinding;
  // Vars
  PLATFORM_FEE_PERCENT?: string;
  RESEND_FROM_EMAIL?: string;
  APP_URL?: string;
  // Secrets (optional; degrade gracefully when absent)
  AUTH_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
}

/** Minimal Images binding surface we use (optional). */
export interface ImagesBinding {
  input(stream: ReadableStream): {
    transform(opts: Record<string, unknown>): {
      output(opts: Record<string, unknown>): Promise<{ response(): Response }>;
    };
  };
}

export interface AuthContext {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
}

export interface RequestContext {
  env: Env;
  auth: AuthContext | null;
  ip: string;
  url: URL;
}
