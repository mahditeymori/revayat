// §6.5 payment-callback duplicate/concurrent-callback resilience test.
// Creates ONE real order + ONE real pending payment against the Zibal
// SANDBOX merchant ('zibal' literal — no real money, matches
// apps/web/e2e/payment.spec.ts's own pattern) via a single /v1/request call,
// then payment-callback.yml fires many concurrent replays of that SAME
// trackId at /payment/callback. This exercises the app's own duplicate-
// settlement guard, not Zibal's infrastructure — one sandbox request per
// run, never scaled with load volume. Requires ZIBAL_MERCHANT=zibal in the
// environment (refuses to run against a real merchant id).
import postgres from 'postgres';
import { writeFileSync } from 'node:fs';

const merchant = process.env.ZIBAL_MERCHANT;
if (merchant !== 'zibal') {
  console.error('refusing to run: ZIBAL_MERCHANT must be the sandbox literal "zibal", got:', merchant ?? '(unset)');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const BASE_URL = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3002';
const AMOUNT_RIAL = 500000;

const [product] = await sql`select id from products where slug = 'loadtest-product'`;
if (!product) {
  console.error('run seed.mjs first — loadtest-product not found');
  process.exit(1);
}

const cartToken = `loadtest-payment-${Date.now()}`;
const [order] = await sql`
  insert into orders (cart_token, shipping_name, shipping_phone, shipping_address, shipping_postal_code, subtotal_rial, total_rial)
  values (${cartToken}, 'کاربر تست بار', '09120000000', 'آدرس تست بار', '1234567890', ${AMOUNT_RIAL}, ${AMOUNT_RIAL})
  returning id
`;

const requestRes = await fetch('https://gateway.zibal.ir/v1/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    merchant,
    amount: AMOUNT_RIAL,
    callbackUrl: `${BASE_URL}/payment/callback`,
    orderId: String(order.id),
    description: 'تست بار — سفارش نمونه',
  }),
});
const requestData = await requestRes.json();
if (requestData.result !== 100 || !requestData.trackId) {
  console.error('zibal /v1/request did not return a usable trackId:', requestData);
  process.exit(1);
}

await sql`
  insert into payments (order_id, track_id, amount_rial, status)
  values (${order.id}, ${String(requestData.trackId)}, ${AMOUNT_RIAL}, 'pending')
`;

const result = { orderId: order.id, trackId: requestData.trackId };
writeFileSync(new URL('./payment-track.json', import.meta.url), JSON.stringify(result));
console.log(JSON.stringify(result, null, 2));
await sql.end();
