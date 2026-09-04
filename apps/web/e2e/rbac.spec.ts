// Phase 8.1 §4 — browser-level RBAC coverage. Every protected admin page
// independently calls requireAdmin()/requirePermission() (src/lib/admin/
// session.ts), and every failure mode below collapses to the same response:
// notFound() → a plain Next.js 404 (deliberate anti-enumeration, not a
// redirect that would hint /admin/... exists). Self-contained: own fixture
// admins, own bare `postgres` connection (mirrors payment.spec.ts /
// auth-stress.spec.ts) — never touches the shared e2e admin fixture from
// global-setup.ts.
import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const PASSWORD = 'rbac-test-only-password-not-real';

const FIXTURE_ADMINS = {
  editor: 'rbac-editor@revayat.test',
  support: 'rbac-support@revayat.test',
  disabled: 'rbac-disabled@revayat.test',
} as const;

const adminIds: Record<string, string> = {};

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  for (const [role, email] of [
    ['editor', FIXTURE_ADMINS.editor],
    ['support', FIXTURE_ADMINS.support],
    ['support', FIXTURE_ADMINS.disabled],
  ] as const) {
    const [admin] = await sql`
      insert into admins (email, password_hash, role, active)
      values (${email}, ${passwordHash}, ${role}, true)
      on conflict (email) do update set password_hash = ${passwordHash}, role = ${role}, active = true
      returning id
    `;
    adminIds[email] = admin.id;
  }
});

test.afterAll(async () => {
  const ids = Object.values(adminIds);
  await sql`delete from admin_sessions where admin_id = any(${ids})`;
  await sql`delete from admins where id = any(${ids})`;
  await sql.end();
});

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('ایمیل').fill(email);
  await page.getByLabel('رمز عبور').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/admin' || url.searchParams.has('error'), { timeout: 15000 }),
    page.getByRole('button', { name: 'ورود' }).click(),
  ]);
}

test('unauthenticated access to a protected page returns 404, not a redirect', async ({ page }) => {
  const response = await page.goto('/admin/orders');
  expect(response?.status()).toBe(404);
});

test('a role lacking the required permission gets 404, not the page', async ({ page }) => {
  await loginAs(page, FIXTURE_ADMINS.support); // support: no products.manage
  const response = await page.goto('/admin/products');
  expect(response?.status()).toBe(404);
});

test('a different role lacking a different permission also gets 404', async ({ page }) => {
  await loginAs(page, FIXTURE_ADMINS.editor); // editor: no orders.view
  const response = await page.goto('/admin/orders');
  expect(response?.status()).toBe(404);
});

test('disabling an admin mid-session immediately blocks further access', async ({ page }) => {
  await loginAs(page, FIXTURE_ADMINS.disabled);
  await expect(page).toHaveURL(/\/admin$/);

  await sql`update admins set active = false where id = ${adminIds[FIXTURE_ADMINS.disabled]}`;

  const response = await page.goto('/admin/orders');
  expect(response?.status()).toBe(404);

  await sql`update admins set active = true where id = ${adminIds[FIXTURE_ADMINS.disabled]}`;
});

test('revoking a session mid-use immediately blocks further access, same cookie', async ({ page }) => {
  await loginAs(page, FIXTURE_ADMINS.support);
  await expect(page).toHaveURL(/\/admin$/);

  await sql`delete from admin_sessions where admin_id = ${adminIds[FIXTURE_ADMINS.support]}`;

  const response = await page.goto('/admin/orders');
  expect(response?.status()).toBe(404);
});
