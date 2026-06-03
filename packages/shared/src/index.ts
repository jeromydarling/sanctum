export * from './constants.js';
export * from './types.js';
export * from './money.js';

/** Generate a slug from a name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Deterministic id for an operator's starter facility (avoids dup provisioning). */
export function starterFacilityId(operatorId: string): string {
  return `fac-${operatorId}`;
}
