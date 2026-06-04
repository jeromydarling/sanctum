import type { Role } from '@sanctum/shared';

export interface Env {
  DB: D1Database;
  SPACE_LOCK: DurableObjectNamespace;
  AI?: Ai;
  STORAGE?: R2Bucket;
  IMAGES?: ImagesBinding;
  /** Cloudflare Email Service binding (env.EMAIL.send). Present once enabled. */
  EMAIL?: SendEmailBinding;
  // Vars
  PLATFORM_FEE_PERCENT?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  APP_URL?: string;
  QBO_ENV?: string; // 'sandbox' | 'production'
  TURNSTILE_SITE_KEY?: string; // public
  // Secrets (optional; degrade gracefully when absent)
  AUTH_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  QBO_CLIENT_ID?: string;
  QBO_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  SENTRY_DSN?: string; // server-side Sentry DSN (worker + cron + DO errors)
}

/** Cloudflare Email Service binding surface (Email Sending). */
export interface SendEmailBinding {
  send(message: {
    to: string;
    from: string;
    subject: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
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
