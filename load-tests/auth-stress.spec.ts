// §6.4 — admin login rate limiting, lockout, and session integrity under
// concurrent attempts. Login is a Server Action (apps/web/src/app/admin/
// login/actions.ts) — real browser required, same reason as
// commerce-concurrency.spec.ts. Owns a dedicated, disposable 'support'-role
// admin (least privilege) so this never touches a real account; created and
// destroyed entirely within this file.
//
// Exact thresholds mirrored from apps/web/src/lib/admin/login.ts (read, not
// guessed): MAX_FAILED_ATTEMPTS=5 locks the account for 15min; the rate
// limiter separately allows 10 attempts/15min per IP and 5/15min per email
// (admin-login:ip:*, admin-login:email:*) — whichever trips first wins, so a
// same-IP burst will usually see 'rate-limited' before 'locked'.
//
// Not executed this session — see docs/LOAD-TESTING.md.
import { expect, test, type Browser } from '@playwright/test';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const EMAIL = 'loadtest-admin@revayat.test';
const PASSWORD = 'loadtest-only-password-not-real';
let adminId: string;

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [admin] = await sql`
    insert into admins (email, password_hash, role, active, failed_login_attempts, locked_until)
    values (${EMAIL}, ${passwordHash}, 'support', true, 0, null)
    on conflict (email) do update set password_hash = ${passwordHash}, active = true, failed_login_attempts = 0, locked_until = null
    returning id
  `;
  adminId = admin.id;
});

test.beforeEach(async () => {
  await sql`delete from rate_limits where key like 'admin-login:%'`;
  await sql`update admins set failed_login_attempts = 0, locked_until = null where id = ${adminId}`;
});

test.afterAll(async () => {
  await sql`delete from admin_sessions where admin_id = ${adminId}`;
  await sql`delete from admins where id = ${adminId}`;
  await sql`delete from rate_limits where key like 'admin-login:%'`;
  await sql.end();
});

async function attemptLogin(browser: Browser, email: string, password: string): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/admin/login');
    await page.getByLabel('ایمیل').fill(email);
    await page.getByLabel('رمز عبور').fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin' || url.searchParams.has('error'), { timeout: 15000 }),
      page.getByRole('button', { name: 'ورود' }).click(),
    ]);
    const url = new URL(page.url());
    return url.pathname === '/admin' ? 'ok' : (url.searchParams.get('error') ?? 'unknown-error');
  } finally {
    await context.close();
  }
}

// All four tests below share one admin row (failed-attempt counter,
// lockout, rate-limit keys) by design — each asserts on that row's exact
// cumulative state. `describe.serial` forces them to run one at a time
// despite this file's global `fullyParallel: true`, so they can't race each
// other and corrupt the shared counter (found by first-ever execution this
// phase: fullyParallel let e.g. the burst test's 20 concurrent attempts
// interleave with the sequential-lockout test on the same row).
test.describe.serial('shared-account behavior', () => {
  test('wrong password and an unknown email return the identical error (no account enumeration)', async ({ browser }) => {
    const wrongPassword = await attemptLogin(browser, EMAIL, 'not-the-real-password');
    const unknownEmail = await attemptLogin(browser, 'no-such-admin@revayat.test', 'anything');
    expect(wrongPassword).toBe('invalid');
    expect(unknownEmail).toBe('invalid');
  });

  test('5 sequential failed attempts lock the account; a 6th correct password is still rejected', async ({ browser }) => {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await attemptLogin(browser, EMAIL, `wrong-${i}`));
    }
    expect(results.at(-1)).toBe('locked');

    // The 6th call is both locked-out AND past the email rate-limit (same
    // threshold, 5) — loginAdmin checks rate-limit first, so this legitimately
    // returns 'rate-limited' here rather than 'locked'. Either is a correct
    // rejection; asserting one exact reason was over-specified.
    const withCorrectPassword = await attemptLogin(browser, EMAIL, PASSWORD);
    expect(['locked', 'rate-limited']).toContain(withCorrectPassword);

    const [row] = await sql`select failed_login_attempts, locked_until from admins where id = ${adminId}`;
    expect(row.failed_login_attempts).toBeGreaterThanOrEqual(5);
    expect(row.locked_until).not.toBeNull();
  });

  test('a burst of concurrent failed attempts trips the rate limiter and never over-increments past a sane bound', async ({ browser }) => {
    const attempts = 20; // > both the IP (10) and email (5) rate-limit windows
    const results = await Promise.all(
      Array.from({ length: attempts }, () => attemptLogin(browser, EMAIL, 'wrong-concurrent')),
    );
    const reasons = new Set(results);
    console.log(`login outcomes: ${JSON.stringify([...reasons].map((r) => [r, results.filter((x) => x === r).length]))}`);
    expect(reasons.has('rate-limited') || reasons.has('locked')).toBe(true);

    const [row] = await sql`select failed_login_attempts from admins where id = ${adminId}`;
    // The rate limiter should have shut most attempts out before they ever
    // reached the DB update — this bounds how high the counter could climb in
    // one burst, catching a broken/missing rate limit (which would let it
    // climb toward `attempts`).
    expect(row.failed_login_attempts).toBeLessThanOrEqual(10);
  });

  test('concurrent correct logins from multiple sessions each get their own valid session, no corruption', async ({ browser }) => {
    await sql`update admins set failed_login_attempts = 0, locked_until = null where id = ${adminId}`;
    await sql`delete from rate_limits where key like 'admin-login:%'`;
    const results = await Promise.all(Array.from({ length: 5 }, () => attemptLogin(browser, EMAIL, PASSWORD)));
    expect(results.every((r) => r === 'ok')).toBe(true);

    const sessions = await sql`select id, expires_at from admin_sessions where admin_id = ${adminId}`;
    expect(sessions.length).toBeGreaterThanOrEqual(5);
    expect(sessions.every((s) => new Date(s.expires_at).getTime() > Date.now())).toBe(true);

    const [row] = await sql`select failed_login_attempts, locked_until from admins where id = ${adminId}`;
    expect(row.failed_login_attempts).toBe(0);
    expect(row.locked_until).toBeNull();
  });
});
