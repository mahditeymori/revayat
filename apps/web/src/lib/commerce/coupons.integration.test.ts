// DB INTEGRATION VERIFIED — hits the real Postgres in DATABASE_URL. Run with
// `npm run test:integration` (not part of the default `npm test`).
//
// Section 7: proves validateCoupon's `for('update')` row lock on the coupon
// itself actually serializes concurrent redemptions instead of two checkouts
// both reading "under the usage limit" and both succeeding, plus the rest of
// the coupon test matrix (discount math, expiry, inactive, min-subtotal,
// phone assignment, and the released -> retried revival path) against real
// Postgres rows rather than by code inspection alone.
import { afterEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, coupons, orders } from '@/db/schema';
import { applyCoupon, releaseCoupon, validateCoupon } from './coupons';

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

  it('computes a percentage discount rounded to the nearest rial', async () => {
    const coupon = await makeCoupon({ type: 'percentage', value: 15, maxUsesTotal: null });
    const result = await validateCoupon(coupon.code, '09120000004', 99999, db);
    expect(result).toEqual({ ok: true, couponId: coupon.id, discountRial: Math.round(99999 * 0.15) });
  });

  it('caps a fixed discount at the subtotal instead of going negative', async () => {
    const coupon = await makeCoupon({ type: 'fixed', value: 999999, maxUsesTotal: null });
    const result = await validateCoupon(coupon.code, '09120000005', 50000, db);
    expect(result).toEqual({ ok: true, couponId: coupon.id, discountRial: 50000 });
  });

  it('rejects an expired coupon', async () => {
    const coupon = await makeCoupon({ expiresAt: new Date(Date.now() - 60_000), maxUsesTotal: null });
    const result = await validateCoupon(coupon.code, '09120000006', 100000, db);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects an inactive coupon', async () => {
    const coupon = await makeCoupon({ active: false, maxUsesTotal: null });
    const result = await validateCoupon(coupon.code, '09120000007', 100000, db);
    expect(result).toEqual({ ok: false, reason: 'inactive' });
  });

  it('rejects when the subtotal is below minSubtotalRial', async () => {
    const coupon = await makeCoupon({ minSubtotalRial: 200000, maxUsesTotal: null });
    const result = await validateCoupon(coupon.code, '09120000008', 100000, db);
    expect(result).toEqual({ ok: false, reason: 'min_subtotal' });
  });

  it('rejects a phone-assigned coupon used by a different phone, and accepts the assigned one', async () => {
    const coupon = await makeCoupon({ assignedPhone: '09121111111', maxUsesTotal: null });
    const wrongPhone = await validateCoupon(coupon.code, '09122222222', 100000, db);
    expect(wrongPhone).toEqual({ ok: false, reason: 'not_assigned_to_phone' });

    const rightPhone = await validateCoupon(coupon.code, '09121111111', 100000, db);
    expect(rightPhone).toEqual({ ok: true, couponId: coupon.id, discountRial: 10000 });
  });

  it('rejects an unknown coupon code', async () => {
    const result = await validateCoupon(`${CODE_PREFIX}does-not-exist`, '09120000009', 100000, db);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a released usage does not count toward the limit, letting a retry re-apply the coupon', async () => {
    const coupon = await makeCoupon({ maxUsesTotal: 1 });
    const orderA = await makeOrder(`${CODE_PREFIX}e`);
    const orderB = await makeOrder(`${CODE_PREFIX}f`);
    const phone = '09120000010';

    await db.transaction(async (tx) => {
      const result = await validateCoupon(coupon.code, phone, 100000, tx);
      if (!result.ok) throw new Error(result.reason);
      await applyCoupon(tx, orderA.id, result.couponId, phone);
    });

    // orderA's attempt is abandoned (payment failed/canceled) — releaseCoupon
    // is what payment-flow.ts's applyDecision calls in that case.
    await releaseCoupon(db, orderA.id);

    const retry = await validateCoupon(coupon.code, phone, 100000, db);
    expect(retry).toEqual({ ok: true, couponId: coupon.id, discountRial: 10000 });

    await db.transaction((tx) => applyCoupon(tx, orderB.id, coupon.id, phone));
    const usages = await db.query.couponUsages.findMany({ where: eq(couponUsages.couponId, coupon.id) });
    expect(usages.filter((u) => u.status === 'reserved')).toHaveLength(1);
  });
});
