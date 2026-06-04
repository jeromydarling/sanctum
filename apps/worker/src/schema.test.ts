import { describe, it, expect } from 'vitest';
import { TABLES } from './schema.js';

describe('generic-upsert column whitelists (security)', () => {
  it('profiles cannot self-set role or email (privilege escalation guard)', () => {
    expect(TABLES.profiles.columns).not.toContain('role');
    expect(TABLES.profiles.columns).not.toContain('email');
  });

  it('facilities cannot self-set network_id (network hijack guard)', () => {
    expect(TABLES.facilities.columns).not.toContain('network_id');
  });

  it('facilities cannot self-set QuickBooks tokens or ical secrets', () => {
    for (const col of ['qbo_access_token', 'qbo_refresh_token', 'qbo_realm_id', 'ical_token', 'external_ical_url']) {
      expect(TABLES.facilities.columns).not.toContain(col);
    }
  });
});
