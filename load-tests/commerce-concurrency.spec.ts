// §6.2/6.3 — concurrent inventory reservation and coupon-usage races.
// Checkout is a Next.js Server Action (apps/web/src/app/cart/actions.ts:1),
// so this can't be driven with raw HTTP (Artillery/k6) — a real browser has
// to submit the real form so the real action runs. Each virtual user gets
// its own BrowserContext (own cookies/cart), and all VUs submit
// concurrently via Promise.all — that's the race this test exists to catch.
//
// Submitting the checkout form is enough: the server creates the order and
// its inventory_reservations/coupon_usages rows *before* redirecting to the
// gateway (confirmed in apps/web/e2e/checkout.spec.ts's stubbed-gateway
// test) — no real Zibal payment needs to complete to exercise the
// reservation/coupon-usage layer this test checks.
//
// Not executed this session — see docs/LOAD-TESTING.md. Requires seed.mjs
// to have been run first (loadtest-product/category).
import { expect, test, type Browser } from '@playwright/test';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const SCARCE_SLUG = 'loadtest-scarce-product';
const SCARCE_STOCK = 5;
const CONCURRENT_USERS = 12; // deliberately > stock, to force the oversell condition if the lock is broken

const SCARCE_COUPON = 'LOADTEST-SCARCE';
const COUPON_MAX_USES = 3;

let scarceProductId: string;
let scarceVariantId: string;

test.beforeAll(async () => {
  const [category] = await sql`select id from categories where slug = 'loadtest-category'`;
  if (!category) throw new Error('run seed.mjs first — loadtest-category not found');

  const [product] = await sql`
    insert into products (slug, name, subtitle, description, price_rial, category_id, active, normalized_search_text)
    values (${SCARCE_SLUG}, 'محصول کمیاب تست بار', 'تست بار', 'برای تست‌های بار — با seed دوباره بازسازی می‌شود.', 500000, ${category.id}, true, 'محصول کمیاب تست بار')
    on conflict (slug) do update set active = true
    returning id
  `;
  scarceProductId = product.id;

  const [existingVariant] = await sql`select id from product_variants where product_id = ${product.id} and size = 'S'`;
  scarceVariantId = existingVariant
    ? (await sql`update product_variants set stock = ${SCARCE_STOCK}, active = true where id = ${existingVariant.id} returning id`)[0].id
    : (await sql`insert into product_variants (product_id, size, stock, active) values (${product.id}, 'S', ${SCARCE_STOCK}, true) returning id`)[0].id;

  await sql`
    insert into coupons (code, type, value, max_uses_total, max_uses_per_customer, min_subtotal_rial, active)
    values (${SCARCE_COUPON}, 'percentage', 5, ${COUPON_MAX_USES}, 1, 0, true)
    on conflict (code) do update set active = true, max_uses_total = ${COUPON_MAX_USES}, max_uses_per_customer = 1
  `;
});

test.afterAll(async () => {
  await sql`delete from orders where id in (select order_id from order_items where variant_id = ${scarceVariantId})`;
  await sql`delete from product_variants where id = ${scarceVariantId}`;
  await sql`delete from products where id = ${scarceProductId}`;
  await sql.end();
});

function uniquePhone(offset: number): string {
  return `09${String(Date.now() + offset).slice(-9)}`;
}

async function attemptCheckout(browser: Browser, phone: string, couponCode?: string): Promise<'ok' | 'blocked'> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`/products/${SCARCE_SLUG}`);
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
    await page.getByRole('status').filter({ hasText: 'به سبد اضافه شد' }).waitFor();
    await page.goto('/checkout');
    await page.getByLabel('نام و نام خانوادگی').fill('کاربر تست بار');
    await page.getByLabel('شماره موبایل').fill(phone);
    await page.getByLabel('استان').fill('تهران');
    await page.getByLabel('شهر').fill('تهران');
    await page.getByLabel('آدرس کامل').fill('آدرس تست بار');
    await page.getByLabel('کد پستی').fill('1234567890');
    if (couponCode) await page.getByLabel('کد تخفیف (اختیاری)').fill(couponCode);
    await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
    // Either the gateway redirect starts, or the form surfaces a blocking
    // error (out of stock / coupon exhausted) — both are valid outcomes for
    // a VU that lost the race; only a hang or a crash is a real failure.
    const result = await Promise.race([
      page.waitForURL(/^https:\/\/gateway\.zibal\.ir\/start\//, { timeout: 20000 }).then(() => 'ok' as const),
      page.getByRole('alert').waitFor({ timeout: 20000 }).then(() => 'blocked' as const),
    ]);
    return result;
  } finally {
    await context.close();
  }
}

test('concurrent checkouts against scarce stock never oversell', async ({ browser }) => {
  const outcomes = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, i) => attemptCheckout(browser, uniquePhone(i))),
  );
  console.log(`checkout outcomes: ${outcomes.filter((o) => o === 'ok').length} ok, ${outcomes.filter((o) => o === 'blocked').length} blocked`);

  const [{ stock }] = await sql`select stock from product_variants where id = ${scarceVariantId}`;
  expect(stock).toBeGreaterThanOrEqual(0);

  const [{ reserved }] = await sql`
    select coalesce(sum(quantity), 0)::int as reserved from inventory_reservations
    where variant_id = ${scarceVariantId} and status = 'reserved'
  `;
  expect(reserved).toBeLessThanOrEqual(SCARCE_STOCK);
});

test('concurrent redemptions of the same coupon respect max_uses_total', async ({ browser }) => {
  const attempts = COUPON_MAX_USES + 5; // deliberately over the limit
  const outcomes = await Promise.all(
    Array.from({ length: attempts }, (_, i) => attemptCheckout(browser, uniquePhone(1000 + i), SCARCE_COUPON)),
  );
  console.log(`coupon outcomes: ${outcomes.filter((o) => o === 'ok').length} ok, ${outcomes.filter((o) => o === 'blocked').length} blocked`);

  const [{ used }] = await sql`
    select count(*)::int as used from coupon_usages cu
    join coupons c on c.id = cu.coupon_id
    where c.code = ${SCARCE_COUPON} and cu.status in ('reserved', 'confirmed')
  `;
  expect(used).toBeLessThanOrEqual(COUPON_MAX_USES);
});
