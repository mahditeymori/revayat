// DB INTEGRATION VERIFIED — hits the real Postgres in DATABASE_URL. Run with
// `npm run test:integration` (not part of the default `npm test`).
//
// Section 7: proves validateCoupon's `for('update')` row lock on the coupon
// itself actually serializes concurrent redemptions instead of two checkouts
// both reading "under the usage limit" and both succeeding.
import { afterEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, coupons, orders } from '@/db/schema';
import { applyCoupon, validateCoupon } from './coupons';

const CODE_PREFIX = 'INTEGRATION-TEST-COUPON-';

async function makeCoupon(overrides: Partial<typeof coupons.$inferInsert> = {}) {
  const [coupon] = await db
    .insert(coupons)
    .values({
      code: `${CODE_PREFIX}${crypto.randomUUID()}`,
      type: 'fixed',
      value: 10000,
      maxUsesTotal: 1,
      ...overrides,
    })
    .returning();
  return coupon;
}

async function makeOrder(cartToken: string) {
  const [order] = await db
    .insert(orders)
    .values({
      cartToken,
      shippingName: 'تست',
      shippingPhone: '09120000000',
      shippingAddress: 'تست',
      shippingPostalCode: '1234567890',
      subtotalRial: 100000,
      totalRial: 100000,
    })
    .returning();
  return order;
}

async function cleanup() {
  const testCoupons = await db.query.coupons.findMany({ where: like(coupons.code, `${CODE_PREFIX}%`) });
  for (const c of testCoupons) {
    await db.delete(couponUsages).where(eq(couponUsages.couponId, c.id));
  }
  await db.delete(coupons).where(like(coupons.code, `${CODE_PREFIX}%`));
  await db.delete(orders).where(like(orders.cartToken, `${CODE_PREFIX}%`));
}

afterEach(cleanup);

describe('validateCoupon — DB integration', () => {
  it('serializes two concurrent redemptions against a maxUsesTotal:1 coupon: exactly one wins', async () => {
    const coupon = await makeCoupon({ maxUsesTotal: 1 });
    const orderA = await makeOrder(`${CODE_PREFIX}a`);
    const orderB = await makeOrder(`${CODE_PREFIX}b`);

    const attempt = (orderId: number, phone: string) =>
      db.transaction(async (tx) => {
        const result = await validateCoupon(coupon.code, phone, 100000, tx);
        if (!result.ok) throw new Error(result.reason);
        await applyCoupon(tx, orderId, result.couponId, phone);
        return result;
      });

    const results = await Promise.allSettled([
      attempt(orderA.id, '09120000001'),
      attempt(orderB.id, '09120000002'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toBe('usage_limit_reached');

    const usages = await db.query.couponUsages.findMany({ where: eq(couponUsages.couponId, coupon.id) });
    expect(usages).toHaveLength(1);
  });

  it('rejects a second redemption by the same phone once maxUsesPerCustomer is reached', async () => {
    const coupon = await makeCoupon({ maxUsesTotal: null, maxUsesPerCustomer: 1 });
    const orderA = await makeOrder(`${CODE_PREFIX}c`);
    const phone = '09120000003';

    await db.transaction(async (tx) => {
      const result = await validateCoupon(coupon.code, phone, 100000, tx);
      if (!result.ok) throw new Error(result.reason);
      await applyCoupon(tx, orderA.id, result.couponId, phone);
    });

    const second = await validateCoupon(coupon.code, phone, 100000, db);
    expect(second).toEqual({ ok: false, reason: 'usage_limit_reached' });
  });
});
