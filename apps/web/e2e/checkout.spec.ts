import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { addFixtureProductToCart, fillShippingForm } from './helpers.ts';
import { FIXTURES } from './fixtures.ts';

test('checkout form shows the server-side validation message for its error param', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout?error=phone');
  await expect(page.getByRole('alert')).toHaveText('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).');
  await expect(page.getByLabel('نام و نام خانوادگی')).toBeVisible();
});

test('invalid coupon code is rejected with the exact reason', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout');
  await fillShippingForm(page, { couponCode: 'NOPE-INVALID-CODE' });
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  await page.waitForURL('**/checkout?error=coupon-not_found');
  // Scoped to #main: Next's own route-announcer div also has role="alert",
  // so an unscoped getByRole('alert') strict-mode-matches both.
  await expect(page.locator('#main').getByRole('alert')).toHaveText('کد تخفیف یافت نشد.');
});

test('valid checkout with a valid coupon redirects to the Zibal gateway', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout');
  await fillShippingForm(page, { couponCode: FIXTURES.couponCode });
  // Only stub the browser-level hand-off page — the server-side Zibal
  // "create session" API call (made by our Next.js server, not the browser)
  // still runs for real, so this still proves the whole flow up to gateway
  // hand-off. Not stubbing it would make the test depend on Zibal's hosted
  // checkout UI staying up.
  await page.route('https://gateway.zibal.ir/start/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'zibal-stub' }),
  );
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  await page.waitForURL(/^https:\/\/gateway\.zibal\.ir\/start\//);

  // The gateway hand-off is stubbed, so the real order/reservation this just
  // created server-side never reaches a terminal state (paid/failed) on its
  // own — clean it up now instead of leaving it to hold shared fixture stock
  // for the rest of the suite run. cartToken cookie name from
  // src/app/checkout/actions.ts; orders/reservations/coupon_usages cascade
  // on orders.id.
  const cartToken = (await page.context().cookies()).find((c) => c.name === 'cartToken')?.value;
  if (cartToken) {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      await sql`delete from orders where cart_token = ${cartToken}`;
    } finally {
      await sql.end();
    }
  }
});
