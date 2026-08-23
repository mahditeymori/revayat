// Run: npm test   (node --test --experimental-strip-types, no framework)
//
// End-to-end payment flow against a stubbed gateway: fetch is replaced, and
// DATA_DIR points at a temp directory, so these exercise the real orders.json
// and payments.json code paths without touching Zibal or the repo's data.
//
// The scenarios are the ones from the integration checklist: a successful
// payment, a failed one, a cancelled one, a duplicate callback, an
// already-verified transaction, and a verify whose amount does not match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'revayat-pay-'));
process.env.DATA_DIR = dir;
process.env.ZIBAL_MERCHANT = 'zibal'; // the documented sandbox merchant

// --- Gateway stub ----------------------------------------------------------

type Reply = Record<string, unknown>;
const replies: { request?: Reply; verify?: Reply; inquiry?: Reply } = {};
const calls: { path: string; body: Record<string, unknown> }[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const href = String(url);
  const body = JSON.parse(String(init?.body ?? '{}'));
  const key = href.endsWith('/v1/request') ? 'request' : href.endsWith('/v1/verify') ? 'verify' : 'inquiry';
  calls.push({ path: key, body });
  return new Response(JSON.stringify(replies[key] ?? { result: 100 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

// Imported after DATA_DIR and the stub are in place.
const { startPayment, settlePayment, reconcilePayment } = await import('./payment-flow.ts');
const { createOrder, getOrder, orderPaymentState } = await import('./catalog.ts');
const { getPaymentByTrackId, listPayments } = await import('./payments.ts');

const CALLBACK = 'https://revayat.shop/payment/callback';
const CUSTOMER = {
  name: 'کاربر آزمایشی', phone: '09121234567', email: '',
  state: 'تهران', city: 'تهران', address: 'خیابان نمونه', postcode: '',
};
const item = (priceRial: number) => ({
  productId: 1, name: 'تی‌شرت دماوند', image: '', size: 'L', color: 'مشکی',
  quantity: 1, priceRial,
});

/** A fresh order + started payment. Returns the trackId the stub handed out. */
async function started(priceRial: number, trackId: number) {
  const order = await createOrder(CUSTOMER, [item(priceRial)]);
  replies.request = { result: 100, trackId };
  const res = await startPayment(order, CALLBACK);
  assert.ok(res.ok, 'startPayment should succeed');
  return { order, trackId: String(trackId), redirectUrl: res.ok ? res.redirectUrl : '' };
}

test.after(async () => {
  globalThis.fetch = realFetch;
  await fs.rm(dir, { recursive: true, force: true });
});

// --- 1. Successful payment -------------------------------------------------

test('a successful payment marks the order paid and stores the bank details', async () => {
  const { order, trackId, redirectUrl } = await started(4_500_000, 9001);

  // The browser is sent to the documented start URL for this trackId.
  assert.equal(redirectUrl, 'https://gateway.zibal.ir/start/9001');

  // The request carried everything Zibal needs, with the merchant server-side.
  const req = calls.at(-1)!;
  assert.equal(req.path, 'request');
  assert.equal(req.body.merchant, 'zibal');
  assert.equal(req.body.amount, 4_500_000); // Rial, not Toman
  assert.equal(req.body.orderId, String(order.id));
  assert.equal(req.body.callbackUrl, CALLBACK);
  assert.equal(req.body.mobile, '09121234567');

  // A pending row exists before the customer ever comes back.
  const pending = await getPaymentByTrackId(trackId);
  assert.equal(pending?.status, 'pending');
  assert.equal(pending?.verified, false);
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'awaiting');

  replies.verify = {
    result: 100,
    status: 1,
    amount: 4_500_000,
    refNumber: 1234567890,
    cardNumber: '621986******1234',
    paidAt: '2026-08-22T10:15:00.000Z',
  };
  const settled = await settlePayment(trackId);

  assert.equal(settled.outcome, 'paid');
  assert.equal(calls.at(-1)!.path, 'verify');
  assert.equal(calls.at(-1)!.body.merchant, 'zibal');

  const payment = await getPaymentByTrackId(trackId);
  assert.equal(payment?.status, 'paid');
  assert.equal(payment?.verified, true);
  assert.equal(payment?.transactionId, '1234567890');
  assert.equal(payment?.cardNumber, '621986******1234');
  assert.ok(payment?.paymentDate);
  assert.equal(payment?.errorMessage, null);

  const paidOrder = await getOrder(order.id);
  assert.equal(orderPaymentState(paidOrder!), 'paid');
  assert.equal(paidOrder!.paidTrackId, trackId);
});

// --- 2. Duplicate callback -------------------------------------------------

test('a repeated callback does not re-verify or double-count', async () => {
  const { order, trackId } = await started(4_500_000, 9002);
  replies.verify = { result: 100, status: 1, amount: 4_500_000, refNumber: 42 };

  const first = await settlePayment(trackId);
  const verifyCalls = calls.filter((c) => c.path === 'verify').length;

  // Zibal (or the customer's back button) hits the callback again.
  const second = await settlePayment(trackId);

  assert.equal(first.outcome, 'paid');
  assert.equal(second.outcome, 'already-paid'); // distinct outcome, same money
  assert.equal(
    calls.filter((c) => c.path === 'verify').length,
    verifyCalls,
    'the second callback must not call /v1/verify again',
  );

  // Exactly one payment row, and the order was not touched twice.
  const rows = (await listPayments()).filter((p) => p.orderId === order.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'paid');
});

test('concurrent duplicate callbacks verify exactly once', async () => {
  const { trackId } = await started(4_500_000, 9003);
  replies.verify = { result: 100, status: 1, amount: 4_500_000 };
  const before = calls.filter((c) => c.path === 'verify').length;

  const outcomes = await Promise.all([
    settlePayment(trackId),
    settlePayment(trackId),
    settlePayment(trackId),
  ]);

  assert.equal(calls.filter((c) => c.path === 'verify').length, before + 1);
  assert.equal(outcomes.filter((o) => o.outcome === 'paid').length, 1);
  assert.equal((await getPaymentByTrackId(trackId))?.status, 'paid');
});

// --- 3. Failed and cancelled payments --------------------------------------

test('a failed payment leaves the order unpaid and records why', async () => {
  const { order, trackId } = await started(4_500_000, 9004);
  replies.verify = { result: 202, status: 5 }; // insufficient balance

  const settled = await settlePayment(trackId);

  assert.equal(settled.outcome, 'failed');
  const payment = await getPaymentByTrackId(trackId);
  assert.equal(payment?.status, 'failed');
  assert.match(payment!.errorMessage!, /موجودی/); // the real reason, not a generic error
  assert.equal(payment?.statusCode, 5);
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'failed');
});

test('a cancelled payment is reported as cancelled, not as an error', async () => {
  const { trackId } = await started(4_500_000, 9005);
  replies.verify = { result: 202, status: 3 }; // user pressed cancel

  const settled = await settlePayment(trackId);

  assert.equal(settled.outcome, 'canceled');
  assert.match(settled.message, /لغو/);
  assert.equal((await getPaymentByTrackId(trackId))?.status, 'canceled');
});

test('a failed payment is not re-verified by a repeated callback', async () => {
  const { trackId } = await started(4_500_000, 9006);
  replies.verify = { result: 202, status: 5 };
  await settlePayment(trackId);
  const before = calls.filter((c) => c.path === 'verify').length;

  const again = await settlePayment(trackId);

  assert.equal(again.outcome, 'failed');
  assert.equal(calls.filter((c) => c.path === 'verify').length, before);
});

// --- 4. Already-verified transaction ---------------------------------------

test('result 201 from the gateway still completes the order', async () => {
  // Reached when our row says unverified but Zibal has already verified - e.g.
  // the process died between the verify call and the local write.
  const { order, trackId } = await started(4_500_000, 9007);
  replies.verify = { result: 201, status: 1, amount: 4_500_000, refNumber: 77 };

  const settled = await settlePayment(trackId);

  assert.equal(settled.outcome, 'already-paid');
  assert.equal((await getPaymentByTrackId(trackId))?.status, 'paid');
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'paid');
});

// --- 5. Amount tampering ---------------------------------------------------

test('a verify reporting a different amount never completes the order', async () => {
  const { order, trackId } = await started(4_500_000, 9008);
  replies.verify = { result: 100, status: 1, amount: 10_000 }; // paid 1,000 toman for a 450,000 order

  const settled = await settlePayment(trackId);

  assert.equal(settled.outcome, 'failed');
  const payment = await getPaymentByTrackId(trackId);
  assert.equal(payment?.status, 'failed');
  assert.match(payment!.errorMessage!, /مطابقت ندارد/);
  assert.notEqual(orderPaymentState((await getOrder(order.id))!), 'paid');
});

// --- 6. Forged and unknown callbacks ---------------------------------------

test('a callback for a trackId we never issued touches nothing', async () => {
  const before = calls.length;
  const settled = await settlePayment('999999999');

  assert.equal(settled.outcome, 'unknown');
  assert.equal(settled.orderId, null);
  assert.equal(calls.length, before, 'an unknown trackId must not reach the gateway');
});

test('the gateway decides payment, not the callback query string', async () => {
  // The equivalent of someone opening /payment/callback?trackId=…&success=1
  // by hand: settlePayment is given only the trackId and asks Zibal itself.
  const { order, trackId } = await started(4_500_000, 9009);
  replies.verify = { result: 202, status: 3 }; // the gateway says: not paid

  const settled = await settlePayment(trackId);

  assert.notEqual(settled.outcome, 'paid');
  assert.notEqual(orderPaymentState((await getOrder(order.id))!), 'paid');
});

// --- 7. Gateway failures ---------------------------------------------------

test('a request the gateway refuses does not start a payment', async () => {
  const order = await createOrder(CUSTOMER, [item(4_500_000)]);
  replies.request = { result: 102 }; // merchant not found

  const res = await startPayment(order, CALLBACK);

  assert.equal(res.ok, false);
  assert.equal((await listPayments()).filter((p) => p.orderId === order.id).length, 0);
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'failed');
});

test('an order below the gateway minimum is rejected before any network call', async () => {
  const order = await createOrder(CUSTOMER, [item(500)]);
  const before = calls.length;

  const res = await startPayment(order, CALLBACK);

  assert.equal(res.ok, false);
  assert.equal(calls.length, before);
});

test('a verify that never completes leaves the payment retryable', async () => {
  const { trackId } = await started(4_500_000, 9010);

  // The gateway is unreachable for this one call.
  const stub = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const settled = await settlePayment(trackId);
  globalThis.fetch = stub;

  assert.equal(settled.outcome, 'unknown');
  // The claim was released, so a later callback or an admin inquiry can still
  // settle it - the money may well have moved.
  const payment = await getPaymentByTrackId(trackId);
  assert.equal(payment?.verified, false);
  assert.equal(payment?.status, 'pending');

  replies.verify = { result: 100, status: 1, amount: 4_500_000 };
  const retry = await settlePayment(trackId);
  assert.equal(retry.outcome, 'paid');
});

test('an order already paid cannot start a second payment', async () => {
  const { order, trackId } = await started(4_500_000, 9011);
  replies.verify = { result: 100, status: 1, amount: 4_500_000 };
  await settlePayment(trackId);

  const paid = (await getOrder(order.id))!;
  const res = await startPayment(paid, CALLBACK);

  assert.equal(res.ok, false);
  assert.match(res.ok ? '' : res.message, /پیش‌تر پرداخت/);
});

// --- 8. Inquiry ------------------------------------------------------------

test('an inquiry settles a payment whose callback never arrived', async () => {
  // The customer paid and then closed the tab: the row is stuck pending.
  const { order, trackId } = await started(4_500_000, 9012);
  assert.equal((await getPaymentByTrackId(trackId))?.status, 'pending');

  replies.inquiry = { result: 100, status: 1, amount: 4_500_000, refNumber: 555 };
  replies.verify = { result: 100, status: 1, amount: 4_500_000, refNumber: 555 };

  const settled = await reconcilePayment(trackId);

  assert.equal(settled.outcome, 'paid');
  // Inquiry is read-only, so a real verify must follow before funds are settled.
  assert.equal(calls.at(-1)!.path, 'verify');
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'paid');
});

test('an inquiry on a declined transaction records the failure without paying it', async () => {
  // result 100 = the lookup worked; status 4 = the card was declined.
  const { order, trackId } = await started(4_500_000, 9013);
  replies.inquiry = { result: 100, status: 4 };

  const settled = await reconcilePayment(trackId);

  assert.equal(settled.outcome, 'failed');
  assert.equal((await getPaymentByTrackId(trackId))?.statusCode, 4);
  assert.notEqual(orderPaymentState((await getOrder(order.id))!), 'paid');
});

test('an inquiry on a not-yet-paid transaction leaves it pending and retryable', async () => {
  // The regression this guards: /v1/inquiry answers result 100 for any
  // successful *lookup*, so a transaction still awaiting payment (status -1)
  // came back looking exactly like a verified payment. It must stay pending -
  // marking it failed would also take the retry button away from a customer
  // who is still standing at the bank page.
  const { order, trackId } = await started(4_500_000, 9014);
  replies.inquiry = { result: 100, status: -1, amount: 4_500_000 };

  const settled = await reconcilePayment(trackId);

  assert.equal(settled.outcome, 'unknown');
  const payment = await getPaymentByTrackId(trackId);
  assert.equal(payment?.status, 'pending');
  assert.equal(payment?.verified, false);
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'awaiting');

  // ...and it can still be completed once the customer actually pays.
  replies.verify = { result: 100, status: 1, amount: 4_500_000 };
  assert.equal((await settlePayment(trackId)).outcome, 'paid');
});

test('an inquiry whose lookup fails changes nothing', async () => {
  const { order, trackId } = await started(4_500_000, 9015);
  replies.inquiry = { result: 203 }; // trackId not found at the gateway

  const settled = await reconcilePayment(trackId);

  assert.equal(settled.outcome, 'unknown');
  assert.equal((await getPaymentByTrackId(trackId))?.status, 'pending');
  assert.equal(orderPaymentState((await getOrder(order.id))!), 'awaiting');
});

test('an inquiry for an unknown trackId reaches no gateway', async () => {
  const before = calls.length;
  const settled = await reconcilePayment('888888888');
  assert.equal(settled.outcome, 'unknown');
  assert.equal(calls.length, before);
});

// --- 9. Order ids ----------------------------------------------------------

test('order ids are never reused after a delete', async () => {
  // Reuse would let a stale Zibal callback be applied to a different order.
  const { deleteOrder } = await import('./catalog.ts');
  const a = await createOrder(CUSTOMER, [item(4_500_000)]);
  await deleteOrder(a.id);
  const b = await createOrder(CUSTOMER, [item(4_500_000)]);
  assert.ok(b.id > a.id, `${b.id} must not reuse ${a.id}`);
});
