// UNIT VERIFIED — pure bcrypt hash/verify round trip, no DB.
// Rate limiting, lockout, and session creation live in login.ts's loginAdmin
// and are DB INTEGRATION UNVERIFIED here.
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { hashPassword } from './passwordHash';

describe('hashPassword', () => {
  it('produces a hash that bcrypt.compare verifies against the original password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await bcrypt.compare('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await bcrypt.compare('wrong password', hash)).toBe(false);
  });
});
