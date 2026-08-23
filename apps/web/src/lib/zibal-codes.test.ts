// Run: npm test   (node --test --experimental-strip-types, no framework)
//
// These cover the decision that decides whether money changed hands. Every case
// here is one the gateway really produces: a normal payment, a duplicate
// callback, a cancellation, a declined card, and a response whose amount does
// not match the order.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideVerification,
  decideInquiry,
  isTrackId,
  isPayableAmount,
  isPaidStatus,
  isCanceledStatus,
  resultMessage,
  statusMessage,
  cleanField,
  parseGatewayDate,
} from './zibal-codes.ts';

const AMOUNT = 4_500_000; // a 450,000 toman order, in Rial

test('a successful verify for the right amount is a payment', () => {
  const d = decideVerification({ result: 100, status: 1, amount: AMOUNT }, AMOUNT);
  assert.deepEqual(d, { kind: 'paid', alreadyVerified: false });
});

test('result 201 (already verified) still counts as paid', () => {
  // This is what a duplicate callback gets. The money moved on the first pass,
  // so treating 201 as a failure would un-pay a real order.
  const d = decideVerification({ result: 201, status: 1, amount: AMOUNT }, AMOUNT);
  assert.deepEqual(d, { kind: 'paid', alreadyVerified: true });
});

test('a mismatched amount is never treated as a payment', () => {
  // The attack this blocks: replaying a cheap trackId against an expensive order.
  const d = decideVerification({ result: 100, status: 1, amount: 10_000 }, AMOUNT);
  assert.deepEqual(d, { kind: 'amount-mismatch', charged: 10_000, expected: AMOUNT });
});

test('a missing amount does not by itself fail an otherwise valid verify', () => {
  // Absence is not evidence of a mismatch - Zibal omits `amount` on some replies.
  const d = decideVerification({ result: 100, status: 1 }, AMOUNT);
  assert.deepEqual(d, { kind: 'paid', alreadyVerified: false });
});

test('a cancelled payment is distinguished from a failed one', () => {
  // status 3 is the user pressing "cancel"; it should not be shown as an error.
  assert.deepEqual(decideVerification({ result: 202, status: 3 }, AMOUNT), { kind: 'canceled' });
  // insufficient funds is a genuine failure
  assert.deepEqual(decideVerification({ result: 202, status: 5 }, AMOUNT), { kind: 'failed' });
});

test('every non-success result code fails, whatever the amount says', () => {
  for (const result of [102, 103, 104, 105, 106, 113, 202, 203]) {
    const d = decideVerification({ result, status: 1, amount: AMOUNT }, AMOUNT);
    assert.equal(d.kind, 'failed', `result ${result} must not be paid`);
  }
});

test('paid statuses are exactly 1 and 2', () => {
  assert.ok(isPaidStatus(1)); // paid, verified
  assert.ok(isPaidStatus(2)); // paid, awaiting verification
  for (const s of [-2, -1, 3, 4, 5, 6, 11, null, undefined]) assert.ok(!isPaidStatus(s));
  assert.ok(isCanceledStatus(3));
  assert.ok(!isCanceledStatus(1));
});

test('trackIds from a URL are digits and nothing else', () => {
  // The callback query string is public and attacker-controlled.
  assert.ok(isTrackId('9900'));
  assert.ok(!isTrackId('../../etc/passwd'));
  assert.ok(!isTrackId('9900; DROP'));
  assert.ok(!isTrackId(''));
  assert.ok(!isTrackId(null));
  assert.ok(!isTrackId('1'.repeat(21))); // absurdly long
});

test('payable amounts are positive integer rial above the gateway minimum', () => {
  assert.ok(isPayableAmount(4_500_000));
  assert.ok(!isPayableAmount(1_000)); // Zibal rejects <= 1000 with result 105
  assert.ok(!isPayableAmount(0));
  assert.ok(!isPayableAmount(-5_000));
  assert.ok(!isPayableAmount(1_500.5)); // money is always integer rial
  assert.ok(!isPayableAmount(Number.NaN));
});

test('unknown codes still produce a readable message', () => {
  // Never render "undefined" to a customer who just lost money.
  assert.match(resultMessage(999), /۹۹۹|999/);
  assert.match(statusMessage(99), /۹۹|99/);
  assert.equal(statusMessage(null), '');
  assert.equal(resultMessage(100), 'با موفقیت انجام شد.');
  assert.equal(resultMessage(201), 'این تراکنش پیش‌تر تأیید شده است.');
});

// --- Response normalisation ------------------------------------------------
// These cases come from what the live sandbox actually returned, not from the docs.

test('the gateway placeholder "-" is not stored as a card number', () => {
  // Observed on an unpaid transaction: cardNumber and iban both come back "-".
  assert.equal(cleanField('-'), null);
  assert.equal(cleanField(''), null);
  assert.equal(cleanField('   '), null);
  assert.equal(cleanField(null), null);
  assert.equal(cleanField(undefined), null);
  assert.equal(cleanField('621986******1234'), '621986******1234');
});

test('gateway timestamps are read as Tehran time, not server time', () => {
  // "2026-08-22T19:00:52.684000" has no timezone designator. Read as UTC (or as
  // a UTC container's local time) it lands 3.5 hours off; Tehran is UTC+03:30.
  assert.equal(parseGatewayDate('2026-08-22T19:00:52.684000'), '2026-08-22T15:30:52.684Z');
  assert.equal(parseGatewayDate('2026-08-22 19:00:52'), '2026-08-22T15:30:52.000Z');
});

test('a timestamp that already carries a zone is respected', () => {
  assert.equal(parseGatewayDate('2026-08-22T19:00:52Z'), '2026-08-22T19:00:52.000Z');
  assert.equal(parseGatewayDate('2026-08-22T19:00:52+00:00'), '2026-08-22T19:00:52.000Z');
});

test('an unparseable timestamp becomes null rather than an invalid date', () => {
  assert.equal(parseGatewayDate(null), null);
  assert.equal(parseGatewayDate('-'), null);
  assert.equal(parseGatewayDate(''), null);
  assert.equal(parseGatewayDate('not a date'), null);
  // A Jalali-style date parses to year 1405 rather than throwing - reject it
  // instead of writing a 7th-century paidAt onto a receipt.
  assert.equal(parseGatewayDate('1405/06/01 19:00:52'), null);
});

// --- Inquiry vs verify -----------------------------------------------------
// A real bug this caught: /v1/inquiry returns result 100 for a *successful
// lookup*, whatever the payment did. Reusing the verify rule read every
// successful lookup as a successful payment, including status -1 (never paid).

test('an inquiry on an unpaid transaction is not a payment', () => {
  // Exactly what the live sandbox returns for a transaction nobody has paid:
  // result 100 (the query worked) with status -1 (awaiting payment).
  const d = decideInquiry({ result: 100, status: -1, amount: AMOUNT }, AMOUNT);
  assert.deepEqual(d, { kind: 'awaiting' });

  // And the contrast that makes the distinction concrete: the verify rule would
  // have called the very same response a completed payment.
  assert.equal(decideVerification({ result: 100, status: -1, amount: AMOUNT }, AMOUNT).kind, 'paid');
});

test('an inquiry reports a real payment as paid', () => {
  assert.deepEqual(decideInquiry({ result: 100, status: 1, amount: AMOUNT }, AMOUNT), { kind: 'paid' });
  assert.deepEqual(decideInquiry({ result: 100, status: 2, amount: AMOUNT }, AMOUNT), { kind: 'paid' });
});

test('an inquiry still enforces the amount check', () => {
  const d = decideInquiry({ result: 100, status: 1, amount: 10_000 }, AMOUNT);
  assert.deepEqual(d, { kind: 'amount-mismatch', charged: 10_000, expected: AMOUNT });
});

test('an inquiry separates cancellation, failure and a failed lookup', () => {
  assert.deepEqual(decideInquiry({ result: 100, status: 3 }, AMOUNT), { kind: 'canceled' });
  assert.deepEqual(decideInquiry({ result: 100, status: 5 }, AMOUNT), { kind: 'failed' });
  // 203 = trackId not found: nothing is known about the payment either way.
  assert.deepEqual(decideInquiry({ result: 203 }, AMOUNT), { kind: 'query-failed' });
});
