/** Friendly error helpers + telemetry sink. */
import { toast } from 'sonner';
import { ApiError } from './api.js';
import { SUPPORT_EMAIL } from './config.js';

export function humanError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Please sign in to continue.';
    if (e.status === 403) return "You don't have permission to do that.";
    if (e.conflict) return 'This record changed since you loaded it. We refreshed it for you.';
    return e.message;
  }
  if (e instanceof Error) return e.message || 'Something went wrong.';
  return 'Something went wrong.';
}

export function notifyError(e: unknown, fallback?: string): void {
  const msg = fallback || humanError(e);
  const incidentId = e instanceof ApiError ? e.incidentId : undefined;
  toast.error(msg, {
    description: incidentId ? `Incident ${incidentId}` : undefined,
    action: {
      label: 'Get help',
      onClick: () => {
        const subject = encodeURIComponent('Sanctum — I need help');
        const body = encodeURIComponent(
          `I ran into a problem.\n\n${msg}${incidentId ? `\nIncident: ${incidentId}` : ''}`,
        );
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      },
    },
  });
}

/** Report an error to the worker telemetry sink. Best-effort. */
export function reportError(message: string, stack?: string): void {
  try {
    fetch('/api/telemetry/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stack, url: window.location.href }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Install global handlers for uncaught errors + promise rejections. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (e) => {
    reportError(e.message, e.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    reportError(
      reason instanceof Error ? reason.message : String(reason),
      reason instanceof Error ? reason.stack : undefined,
    );
  });
}
