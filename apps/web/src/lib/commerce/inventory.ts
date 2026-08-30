import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryReservations, productVariants } from '@/db/schema';
import type { DbClient } from './types';

// How long a stock hold survives an abandoned checkout (e.g. the shopper
// never returns from the Zibal redirect) before the periodic sweep
// (scripts/release-expired-reservations.ts) releases it.
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

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

// Called only by orders.createOrder, inside its own transaction, so the order
// row and its reservations commit or roll back together. Row-locks each
// variant (`for('update')`) to serialize concurrent checkouts against the
// same variant instead of racing on a stale read of available stock.
export async function reserveStock(
  dbClient: DbClient,
  orderId: number,
  lines: { variantId: string; quantity: number }[],
): Promise<void> {
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

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

    await dbClient.insert(inventoryReservations).values({
      variantId: line.variantId,
      orderId,
      quantity: line.quantity,
      status: 'reserved',
      expiresAt,
    });
  }
}

// reserved -> confirmed, called by settlePayment when a payment settles as paid.
export async function confirmReservations(dbClient: DbClient, orderId: number): Promise<void> {
  await dbClient
    .update(inventoryReservations)
    .set({ status: 'confirmed' })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')));
}

// reserved -> released, called by settlePayment on failed/canceled and by the
// expiry sweep script for abandoned checkouts.
export async function releaseReservations(dbClient: DbClient, orderId: number): Promise<void> {
  await dbClient
    .update(inventoryReservations)
    .set({ status: 'released' })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')));
}
