// DB INTEGRATION VERIFIED — hits the real Postgres in DATABASE_URL. Run with
// `npm run test:integration` (not part of the default `npm test`).
//
// checkRateLimit is the one generic primitive behind every call site in the
// app — admin login (see login.integration.test.ts), checkout submission
// (checkout-submit:ip:*), payment start/retry (payment-start:order:*), and
// admin payment inquiry (payment-inquiry:*). Each call site only supplies a
// distinct key/limit/window, so testing the primitive directly here covers
// all of them without duplicating near-identical suites per call site.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { rateLimits } from '@/db/schema';
import { checkRateLimit } from './rate-limit';

const KEY_PREFIX = 'integration-test:rate-limit:';

async function cleanup() {
  await db.delete(rateLimits).where(like(rateLimits.key, `${KEY_PREFIX}%`));
}

beforeEach(cleanup);
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
});

describe('checkRateLimit — DB integration', () => {
  it('allows requests under the limit and blocks once the limit is exceeded', async () => {
    const key = `${KEY_PREFIX}basic`;
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
    }
    const sixth = await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    expect(sixth.allowed).toBe(false);
    if (!sixth.allowed) expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps distinct keys independent (one order/IP being limited does not affect another)', async () => {
    const keyA = `${KEY_PREFIX}order:1`;
    const keyB = `${KEY_PREFIX}order:2`;
    for (let i = 0; i < 5; i++) await checkRateLimit(keyA, { limit: 5, windowMs: 60_000 });
    const aBlocked = await checkRateLimit(keyA, { limit: 5, windowMs: 60_000 });
    const bAllowed = await checkRateLimit(keyB, { limit: 5, windowMs: 60_000 });
    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
  });

  it('resets the count once the window has fully elapsed', async () => {
    const key = `${KEY_PREFIX}window-reset`;
    for (let i = 0; i < 5; i++) await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    const blocked = await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);

    // toFake: ['Date'] only — see login.integration.test.ts for why faking
    // every timer type hangs the postgres driver.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 61_000));

    const afterWindow = await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    expect(afterWindow.allowed).toBe(true);
  });

  it('persists a row on first use of a key', async () => {
    const key = `${KEY_PREFIX}first-use`;
    await checkRateLimit(key, { limit: 5, windowMs: 60_000 });
    const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key) });
    expect(row).toBeDefined();
  });
});
