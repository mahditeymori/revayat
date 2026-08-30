import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryReservations, productVariants } from '@/db/schema';
import type { DbClient } from './types';

// Reservation lifetime is tied to the actual payment lifecycle, not one flat
// timeout — see lib/zibal/payment-flow.ts for how these two windows compose:
//
//  order created -------- startPayment (trackId issued) -------- verify/settle
//        |<-- CHECKOUT_HOLD_TTL_MS -->|<---- PAYMENT_SESSION_TTL_MS ---->|
//                                      (slides forward on every retry)
//
// reserveStock (called by createOrder) grants the short CHECKOUT_HOLD_TTL_MS —
// if the customer never gets as far as a valid Zibal trackId, the stock
// returns to sale quickly. The moment startPayment obtains a trackId, it
// calls extendReservations to push expiresAt out to PAYMENT_SESSION_TTL_MS,
// sized to comfortably exceed a real bank redirect + OTP round trip; every
// retry re-extends it, so an actively-retrying customer is never swept
// mid-attempt. Only a session with no successful startPayment call in the
// last CHECKOUT_HOLD_TTL_MS, or no settled callback/inquiry in the last
// PAYMENT_SESSION_TTL_MS, is reclaimed by scripts/release-expired-reservations.ts.
export const CHECKOUT_HOLD_TTL_MS = 10 * 60 * 1000;
export const PAYMENT_SESSION_TTL_MS = 30 * 60 * 1000;

const ACTIVE_STATUSES = ['reserved', 'confirmed'] as const;

export class InsufficientStockError extends Error {
  constructor(public readonly variantId: string) {
    super(`Insufficient stock for variant ${variantId}`);
    this.name = 'InsufficientStockError';
  }
}

async function activeReservedQuantity(dbClient: DbClient, variantId: string): Promise<number> {
  const [row] = await dbClient
    .select({ qty: sql<number>`coalesce(sum(${inventoryReservations.quantity}), 0)::int` })
    .from(inventoryReservations)
    .where(
      and(eq(inventoryReservations.variantId, variantId), inArray(inventoryReservations.status, ACTIVE_STATUSES)),
    );
  return row?.qty ?? 0;
}

// Available-to-sell = physical stock - active (reserved|confirmed) holds.
export async function getAvailableStock(variantId: string, dbClient: DbClient = db): Promise<number> {
  const [variant] = await dbClient
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId));
  if (!variant) return 0;

  const reserved = await activeReservedQuantity(dbClient, variantId);
  return Math.max(variant.stock - reserved, 0);
}

// Called by orders.createOrder inside its own transaction (short
// CHECKOUT_HOLD_TTL_MS hold) and by lib/zibal/payment-flow.ts's startPayment
// when re-establishing a hold that expired before a retried payment attempt
// (also inside its own transaction). Row-locks each variant (`for('update')`)
// to serialize concurrent checkouts against the same variant instead of
// racing on a stale read of available stock.
//
// Upserts on the (orderId, variantId) unique constraint rather than plain
// inserting: a retried payment attempt targets the SAME order, and that
// order may already have a `released` row for this variant from an earlier
// expired hold — inserting a second row for the same pair would violate the
// unique index, so a stale row is instead revived back to `reserved`.
export async function reserveStock(
  dbClient: DbClient,
  orderId: number,
  lines: { variantId: string; quantity: number }[],
  ttlMs: number = CHECKOUT_HOLD_TTL_MS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);

  for (const line of lines) {
    const [variant] = await dbClient
      .select({ id: productVariants.id, stock: productVariants.stock, active: productVariants.active })
      .from(productVariants)
      .where(eq(productVariants.id, line.variantId))
      .for('update');

    if (!variant || !variant.active) {
      throw new InsufficientStockError(line.variantId);
    }

    const reserved = await activeReservedQuantity(dbClient, line.variantId);
    const available = variant.stock - reserved;
    if (available < line.quantity) {
      throw new InsufficientStockError(line.variantId);
    }

    await dbClient
      .insert(inventoryReservations)
      .values({
        variantId: line.variantId,
        orderId,
        quantity: line.quantity,
        status: 'reserved',
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [inventoryReservations.orderId, inventoryReservations.variantId],
        set: { quantity: line.quantity, status: 'reserved', expiresAt },
      });
  }
}

// Pushes every still-`reserved` row for this order out to now + ttlMs — a
// sliding window, not a fixed deadline. Called by startPayment once Zibal has
// issued a trackId (a real payment session has begun) and again on every
// retry. A no-op (returns 0) once the order's reservations are
// confirmed/released, which is fine: nothing left to extend.
export async function extendReservations(dbClient: DbClient, orderId: number, ttlMs: number): Promise<number> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await dbClient
    .update(inventoryReservations)
    .set({ expiresAt })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')))
    .returning({ id: inventoryReservations.id });
  return rows.length;
}

// reserved -> confirmed, called by payment-flow.ts when a payment settles as
// paid. Returns the number of rows actually confirmed so the caller can
// detect the rare, TTL-bounded case where a hold expired and was swept before
// a late-arriving payment settled (see payment-flow.ts's applyDecision).
export async function confirmReservations(dbClient: DbClient, orderId: number): Promise<number> {
  const rows = await dbClient
    .update(inventoryReservations)
    .set({ status: 'confirmed' })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')))
    .returning({ id: inventoryReservations.id });
  return rows.length;
}

// reserved -> released, called by payment-flow.ts on failed/canceled payments
// and by the expiry sweep script for abandoned checkouts.
export async function releaseReservations(dbClient: DbClient, orderId: number): Promise<number> {
  const rows = await dbClient
    .update(inventoryReservations)
    .set({ status: 'released' })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')))
    .returning({ id: inventoryReservations.id });
  return rows.length;
}

// How many of an order's stock holds are still active right now — used by
// startPayment to decide whether the existing hold can simply be extended, or
// whether it already expired and must be re-validated/re-reserved from
// scratch before a new payment attempt is created.
export async function countActiveReservations(dbClient: DbClient, orderId: number): Promise<number> {
  const [row] = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryReservations)
    .where(and(eq(inventoryReservations.orderId, orderId), inArray(inventoryReservations.status, ACTIVE_STATUSES)));
  return row?.count ?? 0;
}
