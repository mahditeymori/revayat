// Full Zibal sandbox E2E: exercises src/lib/zibal/payment-flow.ts and
// src/app/payment/callback/route.ts end-to-end against the real hosted Zibal
// sandbox (merchant 'zibal') — no mock/stub of the gateway itself, unlike
// checkout.spec.ts's own gateway-redirect test.
//
// Bare postgres connection for DB assertions, same reason as
// e2e/global-setup.ts: src/db/client.ts (and anything importing it) pulls in
// 'server-only', which throws unconditionally outside a Next.js bundle.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { addFixtureProductToCart, fillShippingForm, uniquePhone } from './helpers.ts';
import { FIXTURES } from './fixtures.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
test.afterAll(async () => {
  await sql.end();
});

async function checkoutToGateway(page: Page, opts: { phone: string; coupon?: string }): Promise<string> {
  await addFixtureProductToCart(page);
  await page.goto('/checkout');
  await fillShippingForm(page, { phone: opts.phone, couponCode: opts.coupon });
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  // domcontentloaded, not the default 'load': the real Zibal sandbox page
  // pulls in third-party trackers that can hang well past DOM-ready, and all
  // we need is to be on the right URL with the page's links interactable.
  await page.waitForURL(/^https:\/\/gateway\.zibal\.ir\/start\//, { timeout: 20000, waitUntil: 'domcontentloaded' });
  return page.url().split('/').pop()!;
}

// The real Zibal sandbox's "test successful/failed payment" links open in a
// NEW browser page (window.open-driven — the anchor's own target attribute
// is null) rather than navigating the current tab; race
// context.waitForEvent('page') against the click to catch whichever page
// actually carries out the redirect chain back to our own /payment/callback.
async function clickZibalOutcome(page: Page, context: BrowserContext, outcome: 'success' | 'fail'): Promise<Page> {
  const linkName = outcome === 'success' ? 'پرداخت تستی موفق' : 'پرداخت تستی ناموفق';
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
    page.getByRole('link', { name: linkName }).click(),
  ]);
  const active = popup ?? page;
  await active.waitForURL(/localhost:3002/, { timeout: 15000 });
  return active;
}

async function cartItemCount(orderId: number): Promise<number> {
  const [row] = await sql`
    select count(*)::int as n from cart_items ci
    join carts c on c.id = ci.cart_id
    where c.token = (select cart_token from orders where id = ${orderId})
  `;
  return row.n;
}

test.describe('Zibal payment — full sandbox flow', () => {
  // Retries scoped to this file only (global config stays retries: 0):
  // these tests navigate to the real hosted gateway.zibal.ir sandbox, which
  // has shown intermittent external network flakiness unrelated to app code
  // (confirmed via a standalone probe: same navigation succeeds in ~1.6s
  // most of the time). Retrying is the standard mitigation for flakiness in
  // a third-party dependency we don't control.
  test.describe.configure({ retries: 2 });

  test('successful payment settles the order, confirms inventory and coupon, clears the cart', async ({ page, context }) => {
    const phone = uniquePhone();
    const trackId = await checkoutToGateway(page, { phone, coupon: FIXTURES.couponCode });
    const active = await clickZibalOutcome(page, context, 'success');

    await expect(active).toHaveURL(/\/payment\/result\?order=\d+/);
    await expect(active.getByText('پرداخت با موفقیت انجام شد')).toBeVisible();
    const orderId = Number(new URL(active.url()).searchParams.get('order'));

    const [payment] = await sql`select status, verified_at from payments where track_id = ${trackId}`;
    expect(payment.status).toBe('succeeded');
    expect(payment.verified_at).not.toBeNull();

    const [order] = await sql`select payment_status from orders where id = ${orderId}`;
    expect(order.payment_status).toBe('paid');

    const reservations = await sql`select status from inventory_reservations where order_id = ${orderId}`;
    expect(reservations.length).toBeGreaterThan(0);
    expect(reservations.every((r) => r.status === 'confirmed')).toBe(true);

    const [coupon] = await sql`select status from coupon_usages where order_id = ${orderId}`;
    expect(coupon.status).toBe('confirmed');

    expect(await cartItemCount(orderId)).toBe(0);
  });

  test('failed payment leaves the order unpaid, releases holds, keeps the cart, and allows retry', async ({
    page,
    context,
  }) => {
    const phone = uniquePhone();
    const trackId = await checkoutToGateway(page, { phone });
    const active = await clickZibalOutcome(page, context, 'fail');

    await expect(active).toHaveURL(/\/payment\/failed\?order=\d+/);
    const orderId = Number(new URL(active.url()).searchParams.get('order'));

    const [payment] = await sql`select status from payments where track_id = ${trackId}`;
    expect(payment.status).toBe('failed');

    const [order] = await sql`select payment_status, status from orders where id = ${orderId}`;
    expect(order.payment_status).toBe('failed');
    expect(order.status).not.toBe('paid');

    const reservations = await sql`select status from inventory_reservations where order_id = ${orderId}`;
    expect(reservations.every((r) => r.status === 'released')).toBe(true);

    expect(await cartItemCount(orderId)).toBeGreaterThan(0);

    // Retry from the same failed-payment page succeeds against a fresh trackId.
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      active.getByRole('button', { name: 'تلاش دوباره برای پرداخت' }).click(),
    ]);
    const gw = popup ?? active;
    await gw.waitForURL(/^https:\/\/gateway\.zibal\.ir\/start\//, { timeout: 15000, waitUntil: 'domcontentloaded' });
    const retryTrackId = gw.url().split('/').pop()!;
    expect(retryTrackId).not.toBe(trackId);

    const finalPage = await clickZibalOutcome(gw, context, 'success');
    await expect(finalPage).toHaveURL(/\/payment\/result\?order=\d+/);

    const rows = await sql`select track_id, status from payments where order_id = ${orderId} order by created_at`;
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('failed');
    expect(rows[1].status).toBe('succeeded');
    expect(rows.filter((r) => r.status === 'succeeded')).toHaveLength(1);

    const [finalOrder] = await sql`select payment_status from orders where id = ${orderId}`;
    expect(finalOrder.payment_status).toBe('paid');
  });

  test('replaying the same callback does not double-settle', async ({ page, context }) => {
    const phone = uniquePhone();
    const trackId = await checkoutToGateway(page, { phone });
    const active = await clickZibalOutcome(page, context, 'success');
    const orderId = Number(new URL(active.url()).searchParams.get('order'));

    const [before] = await sql`select verified_at from payments where track_id = ${trackId}`;
    const reservationsBefore = await sql`select id from inventory_reservations where order_id = ${orderId} and status = 'confirmed'`;

    // Direct replay of the exact callback URL — same as Zibal (or a refreshed
    // browser tab) hitting it a second time.
    await active.goto(`http://localhost:3002/payment/callback?trackId=${trackId}&success=1&status=1`);
    await active.waitForURL(/\/payment\/result\?order=\d+/, { timeout: 15000 });

    const [after] = await sql`select verified_at, status from payments where track_id = ${trackId}`;
    expect(after.status).toBe('succeeded');
    expect(new Date(after.verified_at).getTime()).toBe(new Date(before.verified_at).getTime());

    const reservationsAfter = await sql`select id from inventory_reservations where order_id = ${orderId} and status = 'confirmed'`;
    expect(reservationsAfter.length).toBe(reservationsBefore.length);
  });

  test('amount tampering is rejected: verify amount is compared against our own stored total, not Zibal callback params', async ({
    page,
    context,
  }) => {
    const phone = uniquePhone();
    const trackId = await checkoutToGateway(page, { phone });

    // Zibal's own sandbox will always honestly verify whatever amount our
    // server actually requested — there's no way to make the *real* gateway
    // report a mismatched amount. Diverge our own stored expectation instead,
    // directly via DB, which is exactly the scenario decideVerification's
    // amount check (src/lib/zibal/codes.ts) exists to catch.
    await sql`update payments set amount_rial = amount_rial + 1000000 where track_id = ${trackId}`;

    const active = await clickZibalOutcome(page, context, 'success');
    await expect(active).toHaveURL(/\/payment\/failed\?order=\d+/);
    await expect(active.getByText('مبلغ پرداخت‌شده با مبلغ سفارش مطابقت نداشت.')).toBeVisible();

    const orderId = Number(new URL(active.url()).searchParams.get('order'));
    const [payment] = await sql`select status from payments where track_id = ${trackId}`;
    expect(payment.status).toBe('failed');

    const [order] = await sql`select payment_status from orders where id = ${orderId}`;
    expect(order.payment_status).not.toBe('paid');
  });
});
