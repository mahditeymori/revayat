import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, coupons } from '@/db/schema';
import { CHECKOUT_HOLD_TTL_MS } from './inventory';
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

type CouponRow = typeof coupons.$inferSelect;

// Shared eligibility checks behind both lookup paths below (by code at initial
// checkout, by id when startPayment re-validates a lapsed hold on retry).
// Parametrized by DbClient so it can run inside a transaction in either case.
async function evaluateCoupon(
  dbClient: DbClient,
  coupon: CouponRow,
  phone: string,
  subtotalRial: number,
): Promise<CouponValidationResult> {
  if (!coupon.active) return { ok: false, reason: 'inactive' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (coupon.assignedPhone && coupon.assignedPhone !== phone) return { ok: false, reason: 'not_assigned_to_phone' };
  if (subtotalRial < coupon.minSubtotalRial) return { ok: false, reason: 'min_subtotal' };

  if (coupon.maxUsesTotal != null) {
    const [totalRow] = await dbClient
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), inArray(couponUsages.status, ACTIVE_STATUSES)));
    if ((totalRow?.count ?? 0) >= coupon.maxUsesTotal) {
      return { ok: false, reason: 'usage_limit_reached' };
    }
  }

  const [customerRow] = await dbClient
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

// Looked up by code — the path used at initial checkout, where only the
// user-entered code string is available. Accepts an optional dbClient so
// createOrder can call it inside its own transaction.
export async function validateCoupon(
  code: string,
  phone: string,
  subtotalRial: number,
  dbClient: DbClient = db,
): Promise<CouponValidationResult> {
  const coupon = await dbClient.query.coupons.findFirst({ where: eq(coupons.code, code) });
  if (!coupon) return { ok: false, reason: 'not_found' };
  return evaluateCoupon(dbClient, coupon, phone, subtotalRial);
}

// Looked up by id — used by lib/zibal/payment-flow.ts's startPayment when
// re-establishing a lapsed hold on retry, since only orders.couponId (not the
// original code string) is on hand at that point.
export async function revalidateCouponById(
  couponId: string,
  phone: string,
  subtotalRial: number,
  dbClient: DbClient = db,
): Promise<CouponValidationResult> {
  const coupon = await dbClient.query.coupons.findFirst({ where: eq(coupons.id, couponId) });
  if (!coupon) return { ok: false, reason: 'not_found' };
  return evaluateCoupon(dbClient, coupon, phone, subtotalRial);
}

// Mirrors inventory.reserveStock: called only by orders.createOrder inside its
// transaction (short CHECKOUT_HOLD_TTL_MS hold) and by startPayment when
// re-applying a coupon it just revalidated after a lapsed hold.
//
// Upserts on the (orderId) unique constraint — coupon_usages allows only one
// row per order for its entire lifetime, so a retry that finds an existing
// `released` row must revive it back to `reserved` rather than inserting a
// second row, which would violate the unique index.
export async function applyCoupon(
  dbClient: DbClient,
  orderId: number,
  couponId: string,
  phone: string,
  ttlMs: number = CHECKOUT_HOLD_TTL_MS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await dbClient
    .insert(couponUsages)
    .values({ couponId, orderId, customerPhone: phone, status: 'reserved', expiresAt })
    .onConflictDoUpdate({
      target: couponUsages.orderId,
      set: { couponId, customerPhone: phone, status: 'reserved', expiresAt },
    });
}

// Mirrors inventory.extendReservations: pushes the order's still-`reserved`
// coupon usage out to now + ttlMs. Called by startPayment alongside
// extendReservations once Zibal issues a trackId, and again on every retry.
export async function extendCouponUsage(dbClient: DbClient, orderId: number, ttlMs: number): Promise<number> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await dbClient
    .update(couponUsages)
    .set({ expiresAt })
    .where(and(eq(couponUsages.orderId, orderId), eq(couponUsages.status, 'reserved')))
    .returning({ id: couponUsages.id });
  return rows.length;
}

// reserved -> confirmed, called alongside confirmReservations when a payment
// settles as paid. Returns the affected row count for the same oversell-detection
// purpose as confirmReservations.
export async function confirmCoupon(dbClient: DbClient, orderId: number): Promise<number> {
  const rows = await dbClient
    .update(couponUsages)
    .set({ status: 'confirmed' })
    .where(and(eq(couponUsages.orderId, orderId), eq(couponUsages.status, 'reserved')))
    .returning({ id: couponUsages.id });
  return rows.length;
}

// reserved -> released, called alongside releaseReservations on failed/canceled
// payments and by the expiry sweep for abandoned checkouts.
export async function releaseCoupon(dbClient: DbClient, orderId: number): Promise<number> {
  const rows = await dbClient
    .update(couponUsages)
    .set({ status: 'released' })
    .where(and(eq(couponUsages.orderId, orderId), eq(couponUsages.status, 'reserved')))
    .returning({ id: couponUsages.id });
  return rows.length;
}
