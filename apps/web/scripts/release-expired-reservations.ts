// Releases inventory reservations and coupon usages left `reserved` past
// their expiresAt — i.e. checkouts abandoned mid-Zibal-redirect, never
// settled by a callback either way. Meant to run on a schedule (cron /
// systemd timer hitting `npm run release-expired-reservations` on the host,
// or a container running this on a loop) — without it, an abandoned
// checkout would hold stock and a coupon slot forever.
import { and, eq, lt } from 'drizzle-orm';
import { db } from '../src/db/client';
import { couponUsages, inventoryReservations } from '../src/db/schema';

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
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
