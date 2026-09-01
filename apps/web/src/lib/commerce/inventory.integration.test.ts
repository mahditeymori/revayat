// DB INTEGRATION VERIFIED — hits the real Postgres in DATABASE_URL. Run with
// `npm run test:integration` (not part of the default `npm test`).
//
// Section 6: proves reserveStock's `for('update')` row lock actually
// serializes concurrent checkouts against the same variant instead of both
// reading a stale "available" count and overselling. Two transactions race
// to reserve the last unit of stock; exactly one must win.
import { afterEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryReservations, orders, productVariants, products } from '@/db/schema';
import { InsufficientStockError, getAvailableStock, reserveStock } from './inventory';

const SLUG_PREFIX = 'integration-test-inventory-';

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

async function makeVariant(stock: number) {
  const [product] = await db
    .insert(products)
    .values({ slug: `${SLUG_PREFIX}${crypto.randomUUID()}`, name: 'تست', priceRial: 100000 })
    .returning();
  const [variant] = await db.insert(productVariants).values({ productId: product.id, stock }).returning();
  return { product, variant };
}

async function cleanup() {
  const testProducts = await db.query.products.findMany({ where: like(products.slug, `${SLUG_PREFIX}%`) });
  for (const p of testProducts) {
    const variants = await db.query.productVariants.findMany({ where: eq(productVariants.productId, p.id) });
    for (const v of variants) {
      await db.delete(inventoryReservations).where(eq(inventoryReservations.variantId, v.id));
    }
  }
  // order deletion cascades its inventory_reservations rows too, but the
  // variant-scoped delete above also catches orders already cleaned up.
  await db.delete(orders).where(like(orders.cartToken, `${SLUG_PREFIX}%`));
  await db.delete(products).where(like(products.slug, `${SLUG_PREFIX}%`));
}

afterEach(cleanup);

describe('reserveStock — DB integration', () => {
  it('serializes two concurrent reservations against the last unit of stock: exactly one wins', async () => {
    const { variant } = await makeVariant(1);
    const orderA = await makeOrder(`${SLUG_PREFIX}a`);
    const orderB = await makeOrder(`${SLUG_PREFIX}b`);

    const attempt = (orderId: number) =>
      db.transaction((tx) => reserveStock(tx, orderId, [{ variantId: variant.id, quantity: 1 }]));

    const results = await Promise.allSettled([attempt(orderA.id), attempt(orderB.id)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const available = await getAvailableStock(variant.id);
    expect(available).toBe(0);
  });

  it('allows both reservations when stock covers both', async () => {
    const { variant } = await makeVariant(2);
    const orderA = await makeOrder(`${SLUG_PREFIX}c`);
    const orderB = await makeOrder(`${SLUG_PREFIX}d`);

    const attempt = (orderId: number) =>
      db.transaction((tx) => reserveStock(tx, orderId, [{ variantId: variant.id, quantity: 1 }]));

    const results = await Promise.allSettled([attempt(orderA.id), attempt(orderB.id)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const available = await getAvailableStock(variant.id);
    expect(available).toBe(0);
  });
});
