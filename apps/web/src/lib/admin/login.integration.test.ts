// DB INTEGRATION VERIFIED — hits the real Postgres in DATABASE_URL via
// loginAdmin/checkRateLimit's actual queries. Run with `npm run test:integration`
// (not part of the default `npm test`). Covers the scenarios login.test.ts's pure
// hashPassword test explicitly leaves unverified: lockout after repeated wrong
// passwords, unknown-account behavior, counter reset on success, and rate limiting.
//
// next/headers has no request scope outside an actual Next.js server, so headers()
// and cookies() are mocked here to a fixed IP and a no-op cookie jar. 'server-only'
// is aliased to a no-op in vitest.integration.config.ts so login.ts/session.ts load
// at all under plain Node.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { admins, adminSessions, rateLimits } from '@/db/schema';
import { loginAdmin } from './login';
import { hashPassword } from './passwordHash';

const TEST_IP = '203.0.113.7';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': TEST_IP, 'user-agent': 'vitest-integration' }),
  cookies: async () => ({
    set: () => {},
    get: () => undefined,
    delete: () => {},
  }),
}));

const TEST_EMAIL = 'integration-test-login@revayat.test';
const REAL_PASSWORD = 'correct horse battery staple 42';
let adminId: string;

async function cleanupRateLimitAndSessions() {
  // Matches this suite's own email-keyed rows (TEST_EMAIL and the unknown-email
  // test's literal address, both under @revayat.test) plus the IP-keyed row —
  // a LIKE on the reserved .test TLD rather than one exact key per test, so a
  // new scenario added later can't quietly leave its own row behind.
  await db
    .delete(rateLimits)
    .where(or(like(rateLimits.key, 'admin-login:email:%@revayat.test'), eq(rateLimits.key, `admin-login:ip:${TEST_IP}`)));
  if (!adminId) return;
  await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
}

beforeAll(async () => {
  // Idempotent against a prior run that crashed/timed out before its afterAll
  // cleanup ran — delete any stale row for this email before inserting fresh.
  const stale = await db.query.admins.findFirst({ where: eq(admins.email, TEST_EMAIL) });
  if (stale) {
    await db.delete(adminSessions).where(eq(adminSessions.adminId, stale.id));
    await db.delete(admins).where(eq(admins.id, stale.id));
  }

  const passwordHash = await hashPassword(REAL_PASSWORD);
  const [row] = await db
    .insert(admins)
    .values({ email: TEST_EMAIL, passwordHash, role: 'support', active: true })
    .returning();
  adminId = row.id;
});

afterAll(async () => {
  await cleanupRateLimitAndSessions();
  await db.delete(admins).where(eq(admins.id, adminId));
  vi.useRealTimers();
});

beforeEach(async () => {
  // Each test starts from a clean rate-limit/lockout slate; the admin row itself
  // (email/passwordHash) is reused across tests since only its counters change.
  await cleanupRateLimitAndSessions();
  await db
    .update(admins)
    .set({ failedLoginAttempts: 0, lockedUntil: null, active: true })
    .where(eq(admins.id, adminId));
  vi.useRealTimers();
});

describe('loginAdmin — DB integration', () => {
  it('returns invalid for an unknown email without revealing the account does not exist', async () => {
    const result = await loginAdmin('no-such-admin@revayat.test', 'whatever');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns invalid on wrong password and increments failedLoginAttempts', async () => {
    const result = await loginAdmin(TEST_EMAIL, 'wrong password');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
    expect(row?.failedLoginAttempts).toBe(1);
  });

  it('locks the account after 5 consecutive wrong passwords', async () => {
    for (let i = 0; i < 4; i++) {
      const r = await loginAdmin(TEST_EMAIL, 'wrong password');
      expect(r).toEqual({ ok: false, reason: 'invalid' });
    }
    const fifth = await loginAdmin(TEST_EMAIL, 'wrong password');
    expect(fifth).toEqual({ ok: false, reason: 'locked' });
    const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
    expect(row?.failedLoginAttempts).toBe(5);
    expect(row?.lockedUntil).not.toBeNull();
  });

  it('rejects the correct password while the account is locked', async () => {
    for (let i = 0; i < 5; i++) await loginAdmin(TEST_EMAIL, 'wrong password');
    // The per-email rate limit (also 5 per window) is exhausted by the same 5
    // calls, so the very next call is rejected as rate-limited before the
    // lockedUntil check ever runs — both mechanisms block, but rate-limited is
    // the reason that actually surfaces here, not 'locked'.
    const result = await loginAdmin(TEST_EMAIL, REAL_PASSWORD);
    expect(result).toEqual({ ok: false, reason: 'rate-limited' });
  });

  it('resets failedLoginAttempts to 0 on a successful login and creates a session', async () => {
    const result = await loginAdmin(TEST_EMAIL, REAL_PASSWORD);
    expect(result).toEqual({ ok: true });
    const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
    expect(row?.failedLoginAttempts).toBe(0);
    expect(row?.lockedUntil).toBeNull();
    const sessions = await db.query.adminSessions.findMany({ where: eq(adminSessions.adminId, adminId) });
    expect(sessions).toHaveLength(1);
  });

  it('allows login again once the lockout window has fully elapsed', async () => {
    for (let i = 0; i < 5; i++) await loginAdmin(TEST_EMAIL, 'wrong password');
    const locked = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
    expect(locked?.lockedUntil).not.toBeNull();

    // toFake: ['Date'] only — the postgres driver uses real setTimeout
    // internally for its own connection handling; faking every timer (the
    // vi.useFakeTimers() default) freezes those too and every query hangs.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000));

    const result = await loginAdmin(TEST_EMAIL, REAL_PASSWORD);
    expect(result).toEqual({ ok: true });
  });

  it('rejects login for a deactivated admin even with the correct password', async () => {
    await db.update(admins).set({ active: false }).where(eq(admins.id, adminId));
    const result = await loginAdmin(TEST_EMAIL, REAL_PASSWORD);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });
});
