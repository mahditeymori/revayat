import type { Page } from '@playwright/test';
import { FIXTURES } from './fixtures.ts';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

// Mirrors src/lib/format.ts's toPersianDigits — duplicated here (not
// imported) so e2e stays a plain consumer of the running app, never a
// compile-time dependency on its internals.
export function fa(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('ایمیل').fill(FIXTURES.adminEmail);
  await page.getByLabel('رمز عبور').fill(FIXTURES.adminPassword);
  await page.getByRole('button', { name: 'ورود' }).click();
  await page.waitForURL('**/admin');
}

// Adds the fixture product's first available-for-sale variant to the cart
// via the real storefront UI (no direct DB/cookie seeding) and waits for the
// drawer's "added" confirmation.
export async function addFixtureProductToCart(page: Page): Promise<void> {
  await page.goto(`/products/${FIXTURES.productSlug}`);
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
  await page.getByRole('status').filter({ hasText: 'به سبد اضافه شد' }).waitFor();
}

export async function fillShippingForm(
  page: Page,
  opts: { phone?: string; couponCode?: string } = {},
): Promise<void> {
  await page.getByLabel('نام و نام خانوادگی').fill(FIXTURES.shippingName);
  await page.getByLabel('شماره موبایل').fill(opts.phone ?? FIXTURES.shippingPhone);
  await page.getByLabel('استان').fill('تهران');
  await page.getByLabel('شهر').fill('تهران');
  await page.getByLabel('آدرس کامل').fill(FIXTURES.shippingAddress);
  await page.getByLabel('کد پستی').fill(FIXTURES.shippingPostalCode);
  if (opts.couponCode) await page.getByLabel('کد تخفیف (اختیاری)').fill(opts.couponCode);
}

// A fresh, validly-formatted (PHONE_RE = /^09\d{9}$/) mobile number per call —
// keeps each payment.spec.ts test on its own customer/coupon-usage identity
// so reruns never collide with a previous run's coupon maxUsesPerCustomer or
// pile up orders under one shared fixture phone.
export function uniquePhone(): string {
  return `09${String(Date.now()).slice(-9)}`;
}
