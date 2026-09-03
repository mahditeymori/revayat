import { expect, test } from '@playwright/test';
import { addFixtureProductToCart } from './helpers.ts';
import { FIXTURES } from './fixtures.ts';

async function fillShippingForm(page: import('@playwright/test').Page, couponCode = '') {
  await page.getByLabel('نام و نام خانوادگی').fill(FIXTURES.shippingName);
  await page.getByLabel('شماره موبایل').fill(FIXTURES.shippingPhone);
  await page.getByLabel('استان').fill('تهران');
  await page.getByLabel('شهر').fill('تهران');
  await page.getByLabel('آدرس کامل').fill(FIXTURES.shippingAddress);
  await page.getByLabel('کد پستی').fill(FIXTURES.shippingPostalCode);
  if (couponCode) await page.getByLabel('کد تخفیف (اختیاری)').fill(couponCode);
}

test('checkout form shows the server-side validation message for its error param', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout?error=phone');
  await expect(page.getByRole('alert')).toHaveText('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).');
  await expect(page.getByLabel('نام و نام خانوادگی')).toBeVisible();
});

test('invalid coupon code is rejected with the exact reason', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout');
  await fillShippingForm(page, 'NOPE-INVALID-CODE');
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  await page.waitForURL('**/checkout?error=coupon-not_found');
  // Scoped to #main: Next's own route-announcer div also has role="alert",
  // so an unscoped getByRole('alert') strict-mode-matches both.
  await expect(page.locator('#main').getByRole('alert')).toHaveText('کد تخفیف یافت نشد.');
});

test('valid checkout with a valid coupon redirects to the Zibal gateway', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/checkout');
  await fillShippingForm(page, FIXTURES.couponCode);
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
});
