import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/server/auth/password';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('salts every hash and rejects malformed stored values', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});
