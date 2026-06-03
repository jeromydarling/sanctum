import type { Role } from '@sanctum/shared';

export function homeForRole(role: Role): string {
  if (role === 'operator' || role === 'staff') return '/operator';
  if (role === 'admin') return '/admin';
  return '/renter';
}
