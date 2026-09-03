// Run after any load scenario (commerce, coupon, or payment) to check the
// invariants those scenarios exist to stress: stock never goes negative, no
// reservation/coupon-usage state machine gets stuck, no order settles twice.
// Exits non-zero on the first violated invariant so it's usable as a CI gate
// later, not just a human-read report.
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

let failed = false;
function check(name, rows) {
  if (rows.length > 0) {
    failed = true;
    console.error(`FAIL: ${name} — ${rows.length} violation(s)`, rows.slice(0, 5));
  } else {
    console.log(`OK: ${name}`);
  }
}

check('no variant stock is negative', await sql`select id, stock from product_variants where stock < 0`);

check(
  'no variant is oversold (confirmed reservations must not exceed stock + already-decremented amount is out of scope here; this checks the reservation layer only)',
  await sql`
    select pv.id, pv.stock, coalesce(sum(ir.quantity), 0) as reserved
    from product_variants pv
    join inventory_reservations ir on ir.variant_id = pv.id and ir.status = 'reserved'
    group by pv.id, pv.stock
    having coalesce(sum(ir.quantity), 0) > pv.stock
  `,
);

check(
  'no order has more than one succeeded payment',
  await sql`
    select order_id, count(*) from payments
    where status = 'succeeded'
    group by order_id
    having count(*) > 1
  `,
);

check(
  'no coupon usage count exceeds its max_uses_total',
  await sql`
    select c.code, c.max_uses_total, count(cu.id) as used
    from coupons c
    join coupon_usages cu on cu.coupon_id = c.id and cu.status in ('reserved', 'confirmed')
    where c.max_uses_total is not null
    group by c.code, c.max_uses_total
    having count(cu.id) > c.max_uses_total
  `,
);

check(
  'no reservation is stuck in "reserved" past its expiry (release job should have caught it)',
  await sql`select id, expires_at from inventory_reservations where status = 'reserved' and expires_at < now() - interval '10 minutes'`,
);

await sql.end();
if (failed) process.exit(1);
