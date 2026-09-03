import { expect, test } from '@playwright/test';
import { addFixtureProductToCart, fa } from './helpers.ts';
import { FIXTURES } from './fixtures.ts';

test('adding an item opens the drawer with the item in it', async ({ page }) => {
  await addFixtureProductToCart(page);
  const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(FIXTURES.productName)).toBeVisible();
  await expect(drawer.getByText(fa(1), { exact: true })).toBeVisible();
});

test('increasing quantity in the drawer updates the count', async ({ page }) => {
  await addFixtureProductToCart(page);
  const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
  await drawer.getByRole('button', { name: 'افزایش تعداد' }).click();
  await expect(drawer.getByText(fa(2), { exact: true })).toBeVisible();
});

test('removing the only item empties the cart', async ({ page }) => {
  await addFixtureProductToCart(page);
  const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
  await drawer.getByRole('button', { name: 'حذف' }).click();
  await expect(drawer.getByText('سبد خرید شما خالی است.')).toBeVisible();
});

test('cart drawer and /cart page stay in sync', async ({ page }) => {
  await addFixtureProductToCart(page);
  await page.goto('/cart');
  // Scoped to #main: the drawer's own markup stays mounted (off-screen, not
  // display:none) even when closed, so an unscoped getByText would strict-
  // mode-match both the /cart page's item and the drawer's.
  const main = page.locator('#main');
  await expect(main.getByRole('heading', { name: 'سبد خرید', level: 1 })).toBeVisible();
  await expect(main.getByText(FIXTURES.productName)).toBeVisible();
  await expect(main.getByRole('link', { name: 'ادامه و ثبت سفارش' })).toBeVisible();
});
