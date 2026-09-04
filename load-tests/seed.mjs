// Seeds a dedicated, isolated fixture set for load testing — never reused
// from apps/web/e2e/fixtures.ts, so a load run can't collide with e2e runs
// sharing the same dev DB. Bare postgres connection: same reason as every
// other standalone script in this repo (src/db/client.ts imports
// 'server-only', which throws outside a Next.js bundle).
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const CATEGORY_SLUG = 'loadtest-category';
const PRODUCT_SLUG = 'loadtest-product';
const COUPON_CODE = 'LOADTEST10';
const VARIANT_STOCK = 100000; // effectively unlimited — §6.1/6.2 read/write throughput, not stock-exhaustion behavior

const [category] = await sql`
  insert into categories (slug, name, active)
  values (${CATEGORY_SLUG}, 'دسته تست بار', true)
  on conflict (slug) do update set active = true
  returning id
`;

const [product] = await sql`
  insert into products (slug, name, subtitle, description, price_rial, category_id, active, normalized_search_text)
  values (${PRODUCT_SLUG}, 'محصول تست بار', 'محصول تست بار', 'برای تست‌های بار — با seed دوباره بازسازی می‌شود، دستی ویرایش نکنید.', 500000, ${category.id}, true, 'محصول تست بار')
  on conflict (slug) do update set active = true, price_rial = 500000
  returning id
`;

const [existingVariant] = await sql`select id from product_variants where product_id = ${product.id} and size = 'M'`;
const variant = existingVariant
  ? (await sql`update product_variants set stock = ${VARIANT_STOCK}, active = true where id = ${existingVariant.id} returning id`)[0]
  : (await sql`insert into product_variants (product_id, size, stock, active) values (${product.id}, 'M', ${VARIANT_STOCK}, true) returning id`)[0];

await sql`
  insert into coupons (code, type, value, max_uses_total, max_uses_per_customer, min_subtotal_rial, active)
  values (${COUPON_CODE}, 'percentage', 10, 100000, 1000, 0, true)
  on conflict (code) do update set active = true, max_uses_total = 100000, max_uses_per_customer = 1000
`;

console.log(JSON.stringify({ categoryId: category.id, productId: product.id, productSlug: PRODUCT_SLUG, variantId: variant.id, couponCode: COUPON_CODE }, null, 2));

await sql.end();
