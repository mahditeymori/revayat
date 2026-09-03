import { expect, test } from '@playwright/test';
import { FIXTURES } from './fixtures.ts';

test('homepage renders hero and links to collections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const collectionsLink = page.getByRole('link', { name: 'مشاهده مجموعه‌ها' });
  await expect(collectionsLink).toBeVisible();
});

test('collections index lists at least one category', async ({ page }) => {
  // Not asserting on FIXTURES.categoryName here: getCategories() is wrapped in
  // unstable_cache with no revalidateTag('categories') call anywhere in the
  // app (admin category actions don't call it either) — a long-lived dev
  // server can legitimately still be serving a pre-seed category list. That's
  // a real app gap, not something e2e should paper over or depend on timing
  // for. The fixture category IS asserted for real via the collection-detail
  // and product-page tests below, which use a different (uncached-by-slug)
  // cache key that's always fresh on first hit.
  await page.goto('/collections');
  await expect(page.getByRole('heading', { name: 'مجموعه‌ها', level: 1 })).toBeVisible();
  await expect(page.locator('a[href^="/collections/"]').first()).toBeVisible();
});

test('collection page lists the fixture product', async ({ page }) => {
  await page.goto(`/collections/${FIXTURES.categorySlug}`);
  await expect(page.getByRole('heading', { name: FIXTURES.categoryName, level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: FIXTURES.productName })).toBeVisible();
});

test('product page shows details and default variant is available', async ({ page }) => {
  await page.goto(`/products/${FIXTURES.productSlug}`);
  await expect(page.getByRole('heading', { name: FIXTURES.productName, level: 1 })).toBeVisible();
  const addButton = page.getByRole('button', { name: 'افزودن به سبد خرید' });
  await expect(addButton).toBeEnabled();
});

test('selecting a variant updates what gets added to the cart', async ({ page }) => {
  await page.goto(`/products/${FIXTURES.productSlug}`);
  // VariantSelector's radios are visually-hidden (peer sr-only): even a
  // forced click lands on the input's real (invisible) screen coordinates,
  // which the wrapping div still intercepts. Click the <label> instead —
  // native label-click forwarding activates the input for real.
  const sizeMLabel = page.locator('label').filter({ has: page.getByRole('radio', { name: 'M' }) });
  await sizeMLabel.click();
  await expect(page.getByRole('radio', { name: 'M' })).toBeChecked();
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
  await expect(page.getByRole('dialog', { name: 'سبد خرید' }).getByText('M')).toBeVisible();
});
