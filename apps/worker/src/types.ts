import type { Role } from '@sanctum/shared';

export interface Env {
  DB: D1Database;
  SPACE_LOCK: DurableObjectNamespace;
  /** Static SPA assets binding — served (and SEO-rewritten) by the worker. */
  ASSETS: Fetcher;
  AI?: Ai;
  STORAGE?: R2Bucket;
  IMAGES?: ImagesBinding;
  /** Cloudflare Email Service binding (env.EMAIL.send). Present once enabled. */
  EMAIL?: SendEmailBinding;
  /** Cloudflare version-metadata binding — identifies the deployed version. */
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };
  // Vars
  PLATFORM_FEE_PERCENT?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  APP_URL?: string;
  QBO_ENV?: string; // 'sandbox' | 'production'
  TURNSTILE_SITE_KEY?: string; // public
  GSC_VERIFICATION?: string; // Google Search Console verification token (public)
  CF_ANALYTICS_TOKEN?: string; // Cloudflare Web Analytics beacon token (public, cookieless)
  /**
   * Email verification gate. Default OFF: any value other than "on" means new
   * signups are created already-verified and may use the app immediately.
   * Flip to "on" (one variable) to require email confirmation before login.
   */
  EMAIL_VERIFICATION?: string;
  // Secrets (optional; degrade gracefully when absent)
  AUTH_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /**
   * Signing secret for the Stripe Connect webhook endpoint (events from
   * connected accounts). Same URL as the platform webhook, different secret.
   * When set, signature verification tries STRIPE_WEBHOOK_SECRET first then
   * falls back to this. Leave unset if only platform events are configured.
   */
  STRIPE_CONNECT_WEBHOOK_SECRET?: string;
  QBO_CLIENT_ID?: string;
  QBO_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  SENTRY_DSN?: string; // server-side Sentry DSN (worker + cron + DO errors)
  /**
   * Token guarding the E2E test-account purge endpoint. When unset, a low-value
   * default guard is used; purge is ALSO hard-restricted to throwaway e2e+*
   * test emails, so it can never erase a real account even if the token leaks.
   */
  E2E_ADMIN_TOKEN?: string;
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
