import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, coupons } from '@/db/schema';
import { RESERVATION_TTL_MS } from './inventory';
import type { CouponRejectionReason, CouponValidationResult, DbClient } from './types';

const ACTIVE_STATUSES = ['reserved', 'confirmed'] as const;

export class CouponRejectedError extends Error {
  constructor(public readonly reason: CouponRejectionReason) {
    super(`Coupon rejected: ${reason}`);
    this.name = 'CouponRejectedError';
  }
}

function computeDiscount(type: 'percentage' | 'fixed', value: number, subtotalRial: number): number {
  if (type === 'percentage') return Math.round((subtotalRial * value) / 100);
  return Math.min(value, subtotalRial);
}

export async function validateCoupon(
  code: string,
  phone: string,
  subtotalRial: number,
): Promise<CouponValidationResult> {
  const coupon = await db.query.coupons.findFirst({ where: eq(coupons.code, code) });
  if (!coupon) return { ok: false, reason: 'not_found' };
  if (!coupon.active) return { ok: false, reason: 'inactive' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (subtotalRial < coupon.minSubtotalRial) return { ok: false, reason: 'min_subtotal' };

  if (coupon.maxUsesTotal != null) {
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), inArray(couponUsages.status, ACTIVE_STATUSES)));
    if ((totalRow?.count ?? 0) >= coupon.maxUsesTotal) {
      return { ok: false, reason: 'usage_limit_reached' };
    }
  }

  const [customerRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(
      and(
        eq(couponUsages.couponId, coupon.id),
        eq(couponUsages.customerPhone, phone),
        inArray(couponUsages.status, ACTIVE_STATUSES),
      ),
    );
  if ((customerRow?.count ?? 0) >= coupon.maxUsesPerCustomer) {
    return { ok: false, reason: 'usage_limit_reached' };
  }

  return { ok: true, couponId: coupon.id, discountRial: computeDiscount(coupon.type, coupon.value, subtotalRial) };
}

// Mirrors inventory.reserveStock: called only by orders.createOrder inside its
// transaction, so the coupon hold and the order commit or roll back together.
export async function applyCoupon(
  dbClient: DbClient,
  orderId: number,
  couponId: string,
  phone: string,
): Promise<void> {
  await dbClient.insert(couponUsages).values({
    couponId,
    orderId,
    customerPhone: phone,
    status: 'reserved',
    expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
  });
}

// reserved -> confirmed, called alongside confirmReservations when a payment settles as paid.
export async function confirmCoupon(dbClient: DbClient, orderId: number): Promise<void> {
  await dbClient
    .update(couponUsages)
    .set({ status: 'confirmed' })
    .where(and(eq(couponUsages.orderId, orderId), eq(couponUsages.status, 'reserved')));
}

// reserved -> released, called alongside releaseReservations on failed/canceled
// payments and by the expiry sweep for abandoned checkouts.
export async function releaseCoupon(dbClient: DbClient, orderId: number): Promise<void> {
  await dbClient
    .update(couponUsages)
    .set({ status: 'released' })
    .where(and(eq(couponUsages.orderId, orderId), eq(couponUsages.status, 'reserved')));
}
