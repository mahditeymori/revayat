// Seeds deterministic fixture data before the e2e suite runs. Own bare
// connection, not src/db/client.ts: that module imports 'server-only', which
// throws outside a Next.js bundle — same pattern as scripts/seed-admin.ts.
//
// Everything here is upsert-by-unique-key (never delete-then-reinsert):
// productVariants has no FK-safe way to be recreated once a real order (from
// the checkout spec) references a variant row via orderItems.variantId
// (ON DELETE RESTRICT) — deleting and reinserting would break on the second
// suite run. Upserting in place keeps variant ids stable across runs.
import bcrypt from 'bcryptjs';
import { and, eq, like, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { admins, categories, coupons, orderItems, orders, productVariants, products, rateLimits } from '../src/db/schema.ts';
import { FIXTURES } from './fixtures.ts';

const BCRYPT_ROUNDS = 12;

export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('[e2e:global-setup] DATABASE_URL is not set');

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema: { admins, categories, coupons, orderItems, orders, productVariants, products, rateLimits } });

  try {
    // loginAdmin() rate-limits by IP and by email (src/lib/admin/login.ts) —
    // a real mechanism, separate from admins.lockedUntil, that this global
    // setup doesn't otherwise touch. admin.spec.ts's several loginAsAdmin()
    // calls per run would otherwise exhaust the 5-per-15min email / 10-per-
    // 15min IP limits across suite reruns. The IP key isn't the literal
    // string 'unknown' — Playwright's Chrome hits localhost over IPv6 loopback,
    // so Next sees ip '::1' — so match by prefix instead of guessing the exact
    // IP value.
    await db.delete(rateLimits).where(like(rateLimits.key, 'admin-login:%'));

    const [category] = await db
      .insert(categories)
      .values({ slug: FIXTURES.categorySlug, name: FIXTURES.categoryName, description: 'دسته‌بندی تست برای Playwright', active: true })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: FIXTURES.categoryName, active: true },
      })
      .returning({ id: categories.id });

    const [product] = await db
      .insert(products)
      .values({
        slug: FIXTURES.productSlug,
        name: FIXTURES.productName,
        subtitle: 'محصول تست',
        description: 'برای تست‌های Playwright — با seed دوباره بازسازی می‌شود، دستی ویرایش نکنید.',
        priceRial: FIXTURES.priceRial,
        categoryId: category.id,
        active: true,
        normalizedSearchText: FIXTURES.productName,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: { name: FIXTURES.productName, priceRial: FIXTURES.priceRial, categoryId: category.id, active: true },
      })
      .returning({ id: products.id });

    const variantIds: string[] = [];
    for (const size of FIXTURES.variantSizes) {
      const existing = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.productId, product.id), eq(productVariants.size, size)))
        .then((rows) => rows[0]);
      if (existing) {
        await db.update(productVariants).set({ stock: 5, active: true }).where(eq(productVariants.id, existing.id));
        variantIds.push(existing.id);
      } else {
        const [row] = await db
          .insert(productVariants)
          .values({ productId: product.id, size, stock: 5, active: true })
          .returning({ id: productVariants.id });
        variantIds.push(row.id);
      }
    }

    await db
      .insert(coupons)
      .values({ code: FIXTURES.couponCode, type: 'fixed', value: FIXTURES.couponValueRial, active: true })
      .onConflictDoUpdate({
        target: coupons.code,
        set: { type: 'fixed', value: FIXTURES.couponValueRial, active: true, expiresAt: null, assignedPhone: null, maxUsesPerCustomer: 1, minSubtotalRial: 0 },
      });

    const passwordHash = await bcrypt.hash(FIXTURES.adminPassword, BCRYPT_ROUNDS);
    await db
      .insert(admins)
      .values({ email: FIXTURES.adminEmail, passwordHash, role: 'owner', active: true })
      .onConflictDoUpdate({
        target: admins.email,
        set: { passwordHash, role: 'owner', active: true, failedLoginAttempts: 0, lockedUntil: null },
      });

    // checkout.spec's real "valid checkout" run creates a genuine order every
    // time it executes (same shipping phone as the fixture order, since it
    // reuses FIXTURES.shippingPhone), which would otherwise pile up forever —
    // breaking the admin order-lookup test (ambiguous row match) and the
    // coupon's maxUsesPerCustomer limit on rerun. orderItems/couponUsages/
    // inventoryReservations all cascade on orders.id, so deleting the order
    // row is enough. Never delete the fixture order itself (by cartToken).
    await db.delete(orders).where(and(eq(orders.shippingPhone, FIXTURES.shippingPhone), ne(orders.cartToken, FIXTURES.orderCartToken)));

    // Fixture order for the admin order-action spec: reset to 'pending' every
    // run so the status-transition test always has a fresh edge to exercise.
    const existingOrder = await db.query.orders.findFirst({ where: eq(orders.cartToken, FIXTURES.orderCartToken) });
    let orderId: number;
    if (existingOrder) {
      orderId = existingOrder.id;
      await db.update(orders).set({ status: 'pending', paymentStatus: 'unpaid' }).where(eq(orders.id, orderId));
    } else {
      const [row] = await db
        .insert(orders)
        .values({
          cartToken: FIXTURES.orderCartToken,
          status: 'pending',
          paymentStatus: 'unpaid',
          shippingName: FIXTURES.shippingName,
          shippingPhone: FIXTURES.shippingPhone,
          shippingAddress: FIXTURES.shippingAddress,
          shippingPostalCode: FIXTURES.shippingPostalCode,
          subtotalRial: FIXTURES.priceRial,
          discountRial: 0,
          shippingRial: 0,
          totalRial: FIXTURES.priceRial,
        })
        .returning({ id: orders.id });
      orderId = row.id;
      await db.insert(orderItems).values({
        orderId,
        variantId: variantIds[0],
        productName: FIXTURES.productName,
        variantTitle: FIXTURES.variantSizes[0],
        unitPriceRial: FIXTURES.priceRial,
        quantity: 1,
      });
    }
  } finally {
    await client.end();
  }
}
