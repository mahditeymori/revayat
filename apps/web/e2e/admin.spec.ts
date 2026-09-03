import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers.ts';
import { FIXTURES } from './fixtures.ts';

test('admin can log in with valid credentials', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('کل محصولات')).toBeVisible();
});

test('invalid credentials show the exact error message', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('ایمیل').fill(FIXTURES.adminEmail);
  await page.getByLabel('رمز عبور').fill('wrong-password-entirely');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByText('ایمیل یا رمز عبور نادرست است.')).toBeVisible();
});

test('dashboard shows stat cards and recent activity sections', async ({ page }) => {
  await loginAsAdmin(page);
  for (const label of ['کل محصولات', 'محصولات فعال', 'سفارش‌های در انتظار', 'پرداخت‌های در انتظار']) {
    await expect(page.getByText(label)).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'سفارش‌های اخیر' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'پرداخت‌های اخیر' })).toBeVisible();
});

test('editing a product saves and persists the change', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/products');
  await page.getByPlaceholder('جستجوی نام محصول...').fill(FIXTURES.productName);
  await page.getByRole('button', { name: 'جستجو' }).click();
  await page.getByRole('link', { name: FIXTURES.productName }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);

  const subtitle = page.getByLabel('زیرعنوان');
  const marker = `e2e-${Date.now() % 100000}`;
  await subtitle.fill(marker);
  await page.getByRole('button', { name: 'ذخیره' }).click();

  await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
  await expect(page.getByLabel('زیرعنوان')).toHaveValue(marker);
});

test('transitioning an order status reflects on the order detail page', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/orders');
  const row = page.getByRole('row').filter({ hasText: FIXTURES.shippingName });
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/admin\/orders\/\d+$/);

  await expect(page.getByText('وضعیت فعلی: در انتظار')).toBeVisible();
  await page.getByRole('button', { name: 'انتقال به «در حال پردازش»' }).click();
  await expect(page.getByText('وضعیت فعلی: در حال پردازش')).toBeVisible();
});
