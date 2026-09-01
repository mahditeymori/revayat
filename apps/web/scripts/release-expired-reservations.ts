// Releases inventory reservations and coupon usages left `reserved` past
// their expiresAt — i.e. checkouts abandoned mid-Zibal-redirect, never
// settled by a callback either way. Meant to run on a schedule (cron /
// systemd timer hitting `npm run release-expired-reservations` on the host,
// or a container running this on a loop) — without it, an abandoned
// checkout would hold stock and a coupon slot forever.
import { and, eq, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { couponUsages, inventoryReservations } from '../src/db/schema.ts';

// Own connection, not src/db/client.ts: that module imports 'server-only',
// which throws unconditionally outside a Next.js bundle. Standalone scripts
// run under plain node, so they need a bare drizzle client (same pattern as
// migrate.mjs).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[release-expired-reservations] DATABASE_URL is not set');
  process.exit(1);
}
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema: { couponUsages, inventoryReservations } });

async function main() {
  const now = new Date();

  const releasedReservations = await db
    .update(inventoryReservations)
    .set({ status: 'released' })
    .where(and(eq(inventoryReservations.status, 'reserved'), lt(inventoryReservations.expiresAt, now)))
    .returning({ id: inventoryReservations.id, orderId: inventoryReservations.orderId });

  const releasedCoupons = await db
    .update(couponUsages)
    .set({ status: 'released' })
    .where(and(eq(couponUsages.status, 'reserved'), lt(couponUsages.expiresAt, now)))
    .returning({ id: couponUsages.id, orderId: couponUsages.orderId });

  console.log(
    `[release-expired-reservations] released ${releasedReservations.length} inventory reservation(s), ${releasedCoupons.length} coupon usage(s)`,
  );
}

main()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
