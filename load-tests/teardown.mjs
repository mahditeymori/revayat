// Removes everything a load run can create. Fixture rows themselves
// (category/product/variant/coupon from seed.mjs) are upsert-by-slug/code,
// so they're safe to leave — only orders (and everything that cascades from
// them: order_items, inventory_reservations, coupon_usages, payments) pile
// up across runs and need explicit cleanup.
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const PRODUCT_SLUG = 'loadtest-product';

const [product] = await sql`select id from products where slug = ${PRODUCT_SLUG}`;
if (product) {
  const deleted = await sql`
    delete from orders where id in (
      select distinct o.id from orders o
      join order_items oi on oi.order_id = o.id
      join product_variants pv on pv.id = oi.variant_id
      where pv.product_id = ${product.id}
    )
    returning id
  `;
  console.log(`deleted ${deleted.length} load-test orders (cascades order_items/reservations/coupon_usages/payments)`);
}

await sql.end();
