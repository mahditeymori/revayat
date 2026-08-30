// These cover the decision that decides whether money changed hands. Every case
// here is one the gateway really produces: a normal payment, a duplicate
// callback, a cancellation, a declined card, and a response whose amount does
// not match the order.
import { describe, expect, it } from 'vitest';
import {
  cleanField,
  decideInquiry,
  decideVerification,
  isCanceledStatus,
  isConfigResult,
  isPaidStatus,
  isPayableAmount,
  isTrackId,
  parseGatewayDate,
  resultMessage,
  statusMessage,
} from './codes';

const AMOUNT = 4_500_000; // a 450,000 toman order, in Rial

it('a successful verify for the right amount is a payment', () => {
  const d = decideVerification({ result: 100, status: 1, amount: AMOUNT }, AMOUNT);
  expect(d).toEqual({ kind: 'paid', alreadyVerified: false });
});

it('result 201 (already verified) still counts as paid', () => {
  // This is what a duplicate callback gets. The money moved on the first pass,
  // so treating 201 as a failure would un-pay a real order.
  const d = decideVerification({ result: 201, status: 1, amount: AMOUNT }, AMOUNT);
  expect(d).toEqual({ kind: 'paid', alreadyVerified: true });
});

it('a mismatched amount is never treated as a payment', () => {
  // The attack this blocks: replaying a cheap trackId against an expensive order.
  const d = decideVerification({ result: 100, status: 1, amount: 10_000 }, AMOUNT);
  expect(d).toEqual({ kind: 'amount-mismatch', charged: 10_000, expected: AMOUNT });
});

it('a missing amount does not by itself fail an otherwise valid verify', () => {
  // Absence is not evidence of a mismatch - Zibal omits `amount` on some replies.
  const d = decideVerification({ result: 100, status: 1 }, AMOUNT);
  expect(d).toEqual({ kind: 'paid', alreadyVerified: false });
});

it('a cancelled payment is distinguished from a failed one', () => {
  // status 3 is the user pressing "cancel"; it should not be shown as an error.
  expect(decideVerification({ result: 202, status: 3 }, AMOUNT)).toEqual({ kind: 'canceled' });
  // insufficient funds is a genuine failure
  expect(decideVerification({ result: 202, status: 5 }, AMOUNT)).toEqual({ kind: 'failed' });
});

it('every non-success result code fails, whatever the amount says', () => {
  for (const result of [102, 103, 104, 105, 106, 113, 202, 203]) {
    const d = decideVerification({ result, status: 1, amount: AMOUNT }, AMOUNT);
    expect(d.kind, `result ${result} must not be paid`).toBe('failed');
  }
});

it('paid statuses are exactly 1 and 2', () => {
  expect(isPaidStatus(1)).toBe(true); // paid, verified
  expect(isPaidStatus(2)).toBe(true); // paid, awaiting verification
  for (const s of [-2, -1, 3, 4, 5, 6, 11, null, undefined]) expect(isPaidStatus(s)).toBe(false);
  expect(isCanceledStatus(3)).toBe(true);
  expect(isCanceledStatus(1)).toBe(false);
});

it('trackIds from a URL are digits and nothing else', () => {
  // The callback query string is public and attacker-controlled.
  expect(isTrackId('9900')).toBe(true);
  expect(isTrackId('../../etc/passwd')).toBe(false);
  expect(isTrackId('9900; DROP')).toBe(false);
  expect(isTrackId('')).toBe(false);
  expect(isTrackId(null)).toBe(false);
  expect(isTrackId('1'.repeat(21))).toBe(false); // absurdly long
});

it('payable amounts are positive integer rial above the gateway minimum', () => {
  expect(isPayableAmount(4_500_000)).toBe(true);
  expect(isPayableAmount(1_000)).toBe(false); // Zibal rejects <= 1000 with result 105
  expect(isPayableAmount(0)).toBe(false);
  expect(isPayableAmount(-5_000)).toBe(false);
  expect(isPayableAmount(1_500.5)).toBe(false); // money is always integer rial
  expect(isPayableAmount(Number.NaN)).toBe(false);
});

it('unknown codes still produce a readable message', () => {
  // Never render "undefined" to a customer who just lost money.
  expect(resultMessage(999)).toMatch(/۹۹۹|999/);
  expect(statusMessage(99)).toMatch(/۹۹|99/);
  expect(statusMessage(null)).toBe('');
  expect(resultMessage(100)).toBe('با موفقیت انجام شد.');
  expect(resultMessage(201)).toBe('این تراکنش پیش‌تر تأیید شده است.');
});

// --- Response normalisation ------------------------------------------------
// These cases come from what the live sandbox actually returned, not from the docs.

it('the gateway placeholder "-" is not stored as a card number', () => {
  // Observed on an unpaid transaction: cardNumber and iban both come back "-".
  expect(cleanField('-')).toBeNull();
  expect(cleanField('')).toBeNull();
  expect(cleanField('   ')).toBeNull();
  expect(cleanField(null)).toBeNull();
  expect(cleanField(undefined)).toBeNull();
  expect(cleanField('621986******1234')).toBe('621986******1234');
});

it('gateway timestamps are read as Tehran time, not server time', () => {
  // "2026-08-22T19:00:52.684000" has no timezone designator. Read as UTC (or as
  // a UTC container's local time) it lands 3.5 hours off; Tehran is UTC+03:30.
  expect(parseGatewayDate('2026-08-22T19:00:52.684000')).toBe('2026-08-22T15:30:52.684Z');
  expect(parseGatewayDate('2026-08-22 19:00:52')).toBe('2026-08-22T15:30:52.000Z');
});

it('a timestamp that already carries a zone is respected', () => {
  expect(parseGatewayDate('2026-08-22T19:00:52Z')).toBe('2026-08-22T19:00:52.000Z');
  expect(parseGatewayDate('2026-08-22T19:00:52+00:00')).toBe('2026-08-22T19:00:52.000Z');
});

it('an unparseable timestamp becomes null rather than an invalid date', () => {
  expect(parseGatewayDate(null)).toBeNull();
  expect(parseGatewayDate('-')).toBeNull();
  expect(parseGatewayDate('')).toBeNull();
  expect(parseGatewayDate('not a date')).toBeNull();
  // A Jalali-style date parses to year 1405 rather than throwing - reject it
  // instead of writing a 7th-century paidAt onto a receipt.
  expect(parseGatewayDate('1405/06/01 19:00:52')).toBeNull();
});

// --- Inquiry vs verify -----------------------------------------------------
// A real bug this caught: /v1/inquiry returns result 100 for a *successful
// lookup*, whatever the payment did. Reusing the verify rule read every
// successful lookup as a successful payment, including status -1 (never paid).

it('an inquiry on an unpaid transaction is not a payment', () => {
  // Exactly what the live sandbox returns for a transaction nobody has paid:
  // result 100 (the query worked) with status -1 (awaiting payment).
  const d = decideInquiry({ result: 100, status: -1, amount: AMOUNT }, AMOUNT);
  expect(d).toEqual({ kind: 'awaiting' });

  // And the contrast that makes the distinction concrete: the verify rule would
  // have called the very same response a completed payment.
  expect(decideVerification({ result: 100, status: -1, amount: AMOUNT }, AMOUNT).kind).toBe('paid');
});

it('an inquiry reports a real payment as paid', () => {
  expect(decideInquiry({ result: 100, status: 1, amount: AMOUNT }, AMOUNT)).toEqual({ kind: 'paid' });
  expect(decideInquiry({ result: 100, status: 2, amount: AMOUNT }, AMOUNT)).toEqual({ kind: 'paid' });
});

it('an inquiry still enforces the amount check', () => {
  const d = decideInquiry({ result: 100, status: 1, amount: 10_000 }, AMOUNT);
  expect(d).toEqual({ kind: 'amount-mismatch', charged: 10_000, expected: AMOUNT });
});

it('an inquiry separates cancellation, failure and a failed lookup', () => {
  expect(decideInquiry({ result: 100, status: 3 }, AMOUNT)).toEqual({ kind: 'canceled' });
  expect(decideInquiry({ result: 100, status: 5 }, AMOUNT)).toEqual({ kind: 'failed' });
  // 203 = trackId not found: nothing is known about the payment either way.
  expect(decideInquiry({ result: 203 }, AMOUNT)).toEqual({ kind: 'query-failed' });
});

// --- Configuration errors --------------------------------------------------
// The production outage: checkout said "gateway not configured" and nothing in
// the code distinguished an operator problem from a customer's failed payment.

it('result 115 is a real message, not an unknown-code fallback', () => {
  // Observed live: Zibal answers 115 "invalid IP <addr>" when the calling
  // server is not on the merchant's allowlist. It reached the customer as
  // "خطای نامشخص درگاه (کد 115)", which tells an operator nothing.
  expect(resultMessage(115)).toBe('آدرس IP این سرور در پنل زیبال مجاز نشده است.');
  expect(resultMessage(115)).not.toMatch(/نامشخص/);
  expect(resultMessage(114)).toBe('شناسه سفارش تکراری است.');
});

it('configuration faults are distinguished from payment failures', () => {
  // Ours to fix — every customer is blocked until an operator acts.
  for (const c of [102, 103, 104, 106, 115]) {
    expect(isConfigResult(c), `${c} should be a configuration fault`).toBe(true);
  }
  // The customer's payment genuinely failed; the site is fine.
  for (const c of [202, 203, 201, 100, 105, 113]) {
    expect(isConfigResult(c), `${c} should not be a configuration fault`).toBe(false);
  }
  expect(isConfigResult(null)).toBe(false);
  expect(isConfigResult(undefined)).toBe(false);
});

it('a configuration fault still fails the payment', () => {
  // Being "our fault" must never mean the order gets completed anyway.
  expect(decideVerification({ result: 115, status: 1, amount: AMOUNT }, AMOUNT).kind).toBe('failed');
  expect(decideInquiry({ result: 115 }, AMOUNT).kind).toBe('query-failed');
});
