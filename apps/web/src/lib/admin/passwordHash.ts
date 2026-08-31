// Pure password hashing, split out of login.ts (which pulls in 'server-only'
// + DB + headers()) so it's testable without a request/DB context — mirrors
// lib/commerce/checkoutValidation.ts's split.
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
