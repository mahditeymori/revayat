// Orchestrates a payment attempt against the new orders/payments/
// inventory_reservations/coupon_usages schema. No reference-branch
// precedent — the legacy app never had reservations, retries, or an
// order/payment split, so this logic is new, not ported.
//
// Security properties this file is responsible for upholding:
//  - ZIBAL_MERCHANT never appears here (client.ts owns it).
//  - A callback's query params are NEVER trusted as proof of payment — only
//    verifyPayment()'s own response (settlePayment) or inquirePayment()'s own
//    response (reconcilePayment) can conclude `paid`.
//  - The charged amount is always checked against payments.amountRial, which
//    is itself taken from orders.totalRial at startPayment time — never from
//    a client-supplied total.
//  - Every retry gets a brand-new `payments` row and a fresh trackId; nothing
//    here ever reuses one.
//  - Duplicate/replayed callbacks and repeated admin inquiries are no-ops
//    past the first terminal state (see applyDecision's guards below).
import 'server-only';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderItems, orders, payments } from '@/db/schema';
import {
  applyCoupon,
  CouponRejectedError,
  extendCouponUsage,
  releaseCoupon,
  revalidateCouponById,
  confirmCoupon,
} from '@/lib/commerce/coupons';
import {
  CHECKOUT_HOLD_TTL_MS,
  confirmReservations,
  countActiveReservations,
  extendReservations,
  InsufficientStockError,
  PAYMENT_SESSION_TTL_MS,
  releaseReservations,
  reserveStock,
} from '@/lib/commerce/inventory';
import { callbackUrl } from './callback-url';
import {
  cleanField,
  decideInquiry,
  decideVerification,
  inquirePayment,
  parseGatewayDate,
  requestPayment,
  startUrl,
  verifyPayment,
  type InquiryDecision,
  type VerifyDecision,
} from './client';

type OrderRow = typeof orders.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export type StartPaymentResult =
  | { ok: true; paymentId: string; trackId: string; startUrl: string }
  | {
      ok: false;
      reason: 'not-found' | 'already-paid' | 'insufficient-stock' | 'coupon-rejected' | 'gateway-error';
      message: string;
    };

export type PaymentOutcome =
  | { kind: 'paid'; orderId: number; alreadyVerified: boolean }
  | { kind: 'amount-mismatch'; orderId: number }
  | { kind: 'canceled'; orderId: number }
  | { kind: 'failed'; orderId: number }
  | { kind: 'awaiting'; orderId: number }
  | { kind: 'query-failed'; orderId: number | null }
  | { kind: 'not-found' };

// Re-establishes the order's stock/coupon hold if it lapsed (nothing left
// `reserved` or `confirmed`) before this attempt. A hold that is still active
// is left exactly as-is — startPayment extends it once a trackId exists.
async function ensureHold(order: OrderRow): Promise<void> {
  const active = await countActiveReservations(db, order.id);
  if (active > 0) return;

  await db.transaction(async (tx) => {
    const lines = await tx
      .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    await reserveStock(tx, order.id, lines, CHECKOUT_HOLD_TTL_MS);

    if (order.couponId) {
      const result = await revalidateCouponById(order.couponId, order.shippingPhone, order.subtotalRial, tx);
      if (!result.ok) throw new CouponRejectedError(result.reason);
      await applyCoupon(tx, order.id, order.couponId, order.shippingPhone, CHECKOUT_HOLD_TTL_MS);
    }
  });
}

/**
 * Creates a fresh payment attempt for an order and starts a Zibal session.
 * Called by checkout on first submit, and again by a "retry payment" action
 * on an unpaid order — both paths funnel through this one function.
 */
export async function startPayment(orderId: number, mobile?: string): Promise<StartPaymentResult> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return { ok: false, reason: 'not-found', message: 'سفارش یافت نشد.' };

  // Idempotent guard: a customer retrying after an already-successful payment
  // (stale tab, double click on "pay") must never be charged a second time.
  if (order.paymentStatus === 'paid') {
    return { ok: false, reason: 'already-paid', message: 'این سفارش قبلاً پرداخت شده است.' };
  }

  try {
    await ensureHold(order);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { ok: false, reason: 'insufficient-stock', message: 'موجودی یکی از اقلام سفارش کافی نیست.' };
    }
    if (err instanceof CouponRejectedError) {
      return { ok: false, reason: 'coupon-rejected', message: 'کد تخفیف این سفارش دیگر معتبر نیست.' };
    }
    throw err;
  }

  // Fresh row every attempt — trackId is unique and only assigned once Zibal
  // actually issues one, below.
  const [paymentRow] = await db
    .insert(payments)
    .values({ orderId, amountRial: order.totalRial, status: 'pending' })
    .returning();

  const call = await requestPayment({
    amountRial: order.totalRial,
    orderId: String(orderId),
    description: `سفارش #${orderId} — روایت شاپ`,
    mobile,
    callbackUrl: await callbackUrl(),
  });

  if (!call.ok) {
    // client.ts guarantees requestPayment never returns ok:true without a
    // trackId, so this is the only failure branch. The reservation/coupon
    // hold is deliberately left untouched — it still carries whatever
    // bounded TTL ensureHold gave it moments ago, so the customer can retry
    // (a new payment row, a new trackId) without losing their place in line
    // for stock; the sweep script reclaims the hold if they never do.
    await db
      .update(payments)
      .set({ status: 'failed', gatewayRawResult: call.result })
      .where(eq(payments.id, paymentRow.id));
    return { ok: false, reason: 'gateway-error', message: call.message };
  }

  const trackId = String(call.data.trackId);
  await db.update(payments).set({ trackId }).where(eq(payments.id, paymentRow.id));

  // A real payment session has begun — extend the hold well past a normal
  // bank redirect + OTP round trip. Every retry re-extends it again.
  await extendReservations(db, orderId, PAYMENT_SESSION_TTL_MS);
  await extendCouponUsage(db, orderId, PAYMENT_SESSION_TTL_MS);

  return { ok: true, paymentId: paymentRow.id, trackId, startUrl: startUrl(trackId) };
}

// Minimal shape both VerifyDecision and InquiryDecision funnel into before
// reaching the shared state-transition logic below.
type Decision = { kind: 'paid'; alreadyVerified: boolean } | { kind: 'amount-mismatch' | 'canceled' | 'failed' };

function normalizeVerify(d: VerifyDecision): Decision {
  if (d.kind === 'paid') return { kind: 'paid', alreadyVerified: d.alreadyVerified };
  return { kind: d.kind };
}

// Only called once the caller has already handled 'awaiting'/'query-failed',
// which verify's decision space has no equivalent for.
function normalizeInquiry(d: Exclude<InquiryDecision, { kind: 'awaiting' | 'query-failed' }>): Decision {
  if (d.kind === 'paid') return { kind: 'paid', alreadyVerified: false };
  return { kind: d.kind };
}

function cachedOutcome(paymentRow: PaymentRow): PaymentOutcome {
  switch (paymentRow.status) {
    case 'succeeded':
      return { kind: 'paid', orderId: paymentRow.orderId, alreadyVerified: true };
    case 'canceled':
      return { kind: 'canceled', orderId: paymentRow.orderId };
    case 'failed':
      return { kind: 'failed', orderId: paymentRow.orderId };
    default:
      return { kind: 'awaiting', orderId: paymentRow.orderId };
  }
}

type GatewayPayload = {
  result: number;
  refNumber?: number | string | null;
  cardNumber?: string | null;
  paidAt?: string | null;
};

// The one place that actually transitions a payment/order/reservation/coupon
// state together, fed by either settlePayment (verify) or reconcilePayment
// (inquiry) once both have been reduced to the same minimal Decision shape.
// Every write is additionally WHERE-guarded (payments.status='pending',
// orders.paymentStatus<>'paid') so this function is safe to invoke twice for
// the same payment — a duplicate callback or a repeated inquiry click is a
// no-op past the first call, never a re-processing of an already-settled state.
async function applyDecision(paymentRow: PaymentRow, decision: Decision, raw: GatewayPayload): Promise<PaymentOutcome> {
  const orderId = paymentRow.orderId;

  if (decision.kind === 'paid') {
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: 'succeeded',
          gatewayRawResult: raw.result,
          gatewayRefNumber: raw.refNumber != null ? cleanField(String(raw.refNumber)) : null,
          gatewayCardNumber: cleanField(raw.cardNumber),
          verifiedAt: new Date(parseGatewayDate(raw.paidAt) ?? Date.now()),
        })
        .where(and(eq(payments.id, paymentRow.id), eq(payments.status, 'pending')));

      const confirmedReservations = await confirmReservations(tx, orderId);
      await confirmCoupon(tx, orderId);

      await tx.update(orders).set({ paymentStatus: 'paid', updatedAt: new Date() }).where(eq(orders.id, orderId));

      // Oversell safety net: the TTL redesign (see inventory.ts) makes this
      // rare, but a hold can still be swept between startPayment and a very
      // late-arriving verification. The charge is real and cannot be
      // reversed here, so the order is still marked paid — but this must
      // never fail silently, since it means stock may be oversold.
      const [{ count: expectedLines }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      if (confirmedReservations < expectedLines) {
        console.error(
          `PAYMENT CONFIRMED WITHOUT AN ACTIVE RESERVATION: order ${orderId} confirmed ` +
            `${confirmedReservations}/${expectedLines} inventory holds — check for oversold stock.`,
        );
      }
    });
    return { kind: 'paid', orderId, alreadyVerified: decision.alreadyVerified };
  }

  // amount-mismatch / canceled / failed: release the hold and downgrade the
  // order's aggregate status. Never money we ever received, so nothing to
  // finalize — but guarded against un-paying an order a *different*,
  // possibly earlier-in-time-but-later-arriving attempt already paid.
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: decision.kind === 'canceled' ? 'canceled' : 'failed', gatewayRawResult: raw.result })
      .where(and(eq(payments.id, paymentRow.id), eq(payments.status, 'pending')));
    await releaseReservations(tx, orderId);
    await releaseCoupon(tx, orderId);
    await tx
      .update(orders)
      .set({ paymentStatus: 'failed', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), ne(orders.paymentStatus, 'paid')));
  });

  if (decision.kind === 'canceled') return { kind: 'canceled', orderId };
  if (decision.kind === 'amount-mismatch') return { kind: 'amount-mismatch', orderId };
  return { kind: 'failed', orderId };
}

/**
 * Called by the /payment/callback route. `trackId` must already have passed
 * isTrackId() (digits-only) before reaching here — that's the route's job,
 * this function's job is to never trust anything else about the callback.
 * The ONLY thing that can conclude `paid` is Zibal's own /v1/verify response.
 */
export async function settlePayment(trackId: string): Promise<PaymentOutcome> {
  const paymentRow = await db.query.payments.findFirst({ where: eq(payments.trackId, trackId) });
  if (!paymentRow) return { kind: 'not-found' };

  // Idempotency: a duplicate/replayed callback for an attempt that already
  // reached a terminal state is a guaranteed no-op — return the cached
  // outcome without re-calling Zibal or re-running confirm/release logic.
  if (paymentRow.status !== 'pending') return cachedOutcome(paymentRow);

  const call = await verifyPayment(trackId);
  if (!call.ok) {
    // A network/config failure talking to Zibal is not evidence the payment
    // failed — leave the row `pending` so a retried callback or an admin
    // inquiry can resolve it later, rather than releasing a hold that may
    // belong to a payment which actually succeeded.
    console.error(`[zibal] settlePayment(${trackId}): verify call failed — ${call.message}`);
    return { kind: 'query-failed', orderId: paymentRow.orderId };
  }

  const decision = decideVerification(call.data, paymentRow.amountRial);
  return applyDecision(paymentRow, normalizeVerify(decision), call.data);
}

/**
 * Admin "inquire" action — read-only reconciliation for a payment whose
 * callback never arrived. Uses /v1/inquiry, NOT /v1/verify: inquiry has no
 * side effect on the gateway, so it's safe to call repeatedly, but its
 * result=100 means only "the lookup worked", never "the payment succeeded" —
 * decideInquiry (not decideVerification) is what actually reads `status`.
 */
export async function reconcilePayment(paymentId: string): Promise<PaymentOutcome> {
  const paymentRow = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!paymentRow || !paymentRow.trackId) return { kind: 'not-found' };

  if (paymentRow.status !== 'pending') return cachedOutcome(paymentRow);

  const call = await inquirePayment(paymentRow.trackId);
  if (!call.ok) {
    console.error(`[zibal] reconcilePayment(${paymentId}): inquiry call failed — ${call.message}`);
    return { kind: 'query-failed', orderId: paymentRow.orderId };
  }

  const decision = decideInquiry(call.data, paymentRow.amountRial);
  if (decision.kind === 'awaiting') return { kind: 'awaiting', orderId: paymentRow.orderId };
  if (decision.kind === 'query-failed') return { kind: 'query-failed', orderId: paymentRow.orderId };

  return applyDecision(paymentRow, normalizeInquiry(decision), call.data);
}

// Read-only lookup for the receipt page (/payment/result) — never used to
// decide payment state, only to display what applyDecision already committed.
export async function getSucceededPayment(orderId: number): Promise<PaymentRow | null> {
  const row = await db.query.payments.findFirst({
    where: and(eq(payments.orderId, orderId), eq(payments.status, 'succeeded')),
    orderBy: (p, { desc: orderDesc }) => orderDesc(p.verifiedAt),
  });
  return row ?? null;
}
