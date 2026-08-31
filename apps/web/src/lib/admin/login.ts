import 'server-only';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/db/client';
import { admins } from '@/db/schema';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createSession } from './session';
import { hashPassword } from './passwordHash';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
// A hash of no real password, compared against on an unknown-email login so
// that path costs the same bcrypt work as a real one — timing alone must not
// tell an attacker whether an email exists in admins.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export { hashPassword };

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'locked' | 'rate-limited' };

export async function loginAdmin(email: string, password: string): Promise<LoginResult> {
  const h = await headers();
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown';

  // Defense-in-depth alongside middleware's coarser IP limiting: this domain
  // function enforces its own throttle regardless of what middleware does.
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`admin-login:ip:${ip}`, { limit: 10, windowMs: LOCKOUT_MS }),
    checkRateLimit(`admin-login:email:${email.toLowerCase()}`, { limit: 5, windowMs: LOCKOUT_MS }),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return { ok: false, reason: 'rate-limited' };

  const admin = await db.query.admins.findFirst({ where: eq(admins.email, email.toLowerCase()) });

  if (!admin) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, reason: 'invalid' };
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return { ok: false, reason: 'locked' };
  }

  const valid = admin.active && (await bcrypt.compare(password, admin.passwordHash));
  if (!valid) {
    const attempts = admin.failedLoginAttempts + 1;
    await db
      .update(admins)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : admin.lockedUntil,
      })
      .where(eq(admins.id, admin.id));
    return { ok: false, reason: attempts >= MAX_FAILED_ATTEMPTS ? 'locked' : 'invalid' };
  }

  await db.update(admins).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(admins.id, admin.id));
  await createSession(admin.id);
  return { ok: true };
}
