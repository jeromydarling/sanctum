/** Client-side id generation (deterministic-prefix UUIDs). */
export function genId(prefix = 'id'): string {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${uuid}`;
}
