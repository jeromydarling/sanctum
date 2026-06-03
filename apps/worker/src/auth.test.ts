import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, constantTimeEqual } from './auth.js';

describe('PBKDF2 passwords', () => {
  it('round-trips a password', async () => {
    const { hash, salt } = await hashPassword('sanctum-demo');
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // 256-bit hex
    expect(await verifyPassword('sanctum-demo', hash, salt)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { hash, salt } = await hashPassword('correct-horse');
    expect(await verifyPassword('battery-staple', hash, salt)).toBe(false);
  });

  it('produces distinct salts each time', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('constantTimeEqual', () => {
  it('matches equal strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
  });
  it('rejects different strings and lengths', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
