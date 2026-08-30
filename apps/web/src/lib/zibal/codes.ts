// Zibal's result/status code tables and the pure decisions built on them.
//
// Deliberately free of `server-only`, `next/headers` and `fetch`: this is the
// security-critical half of the integration (is this response a real payment?
// for the right amount?) and it must be unit-testable without a request scope
// or a network. client.ts re-exports everything here, so callers import one module.

// --- Result codes (the `result` field on every response) -------------------

export const RESULT_MESSAGES: Record<number, string> = {
  100: 'با موفقیت انجام شد.',
  102: 'پذیرنده یافت نشد.',
  103: 'پذیرنده غیرفعال است.',
  104: 'پذیرنده نامعتبر است.',
  105: 'مبلغ باید بیشتر از ۱٬۰۰۰ ریال باشد.',
  106: 'آدرس بازگشت نامعتبر است.',
  113: 'مبلغ تراکنش از سقف مجاز بیشتر است.',
  // 114/115 are configuration errors on the merchant account, observed live:
  // Zibal answers 115 ("invalid IP <addr>") when the calling server's address is
  // not on the merchant's allowlist in the Zibal panel. It looks like a payment
  // failure to the customer, so it must not read as a generic unknown error.
  114: 'شناسه سفارش تکراری است.',
  115: 'آدرس IP این سرور در پنل زیبال مجاز نشده است.',
  201: 'این تراکنش پیش‌تر تأیید شده است.',
  202: 'پرداخت انجام نشده یا ناموفق بوده است.',
  203: 'شناسه پیگیری نامعتبر است.',
};

export const resultMessage = (code: number): string =>
  RESULT_MESSAGES[code] ?? `خطای نامشخص درگاه (کد ${code}).`;

/**
 * Result codes that mean "this site is misconfigured", not "this payment
 * failed". They affect every customer identically until an operator changes
 * something in the Zibal panel or the environment, so they are logged as
 * configuration faults and surfaced in the admin panel rather than being shown
 * to the customer as an ordinary payment error.
 */
const CONFIG_RESULTS = new Set([102, 103, 104, 106, 115]);

export const isConfigResult = (code: number | null | undefined): boolean =>
  code != null && CONFIG_RESULTS.has(code);

// --- Transaction status codes (the `status` field) -------------------------

export const STATUS_MESSAGES: Record<number, string> = {
  [-1]: 'در انتظار پرداخت.',
  [-2]: 'خطای داخلی درگاه.',
  1: 'پرداخت شده — تأیید شده.',
  2: 'پرداخت شده — تأیید نشده.',
  3: 'پرداخت توسط کاربر لغو شد.',
  4: 'شماره کارت نامعتبر است.',
  5: 'موجودی حساب کافی نیست.',
  6: 'رمز واردشده اشتباه است.',
  7: 'تعداد درخواست‌ها بیش از حد مجاز است.',
  8: 'تعداد پرداخت اینترنتی روزانه بیش از حد مجاز است.',
  9: 'مبلغ پرداخت اینترنتی روزانه بیش از حد مجاز است.',
  10: 'صادرکننده‌ی کارت نامعتبر است.',
  11: 'خطای سوییچ بانکی — کمی بعد دوباره تلاش کنید.',
  12: 'کارت قابل دسترسی نیست.',
};

export const statusMessage = (code: number | null | undefined): string =>
  code == null ? '' : (STATUS_MESSAGES[code] ?? `وضعیت نامشخص (کد ${code}).`);

/** 1 = paid & verified, 2 = paid but not yet verified. Anything else is not money in hand. */
export const isPaidStatus = (status: number | null | undefined): boolean =>
  status === 1 || status === 2;

/** The user pressed cancel on the bank page - not an error worth alarming them about. */
export const isCanceledStatus = (status: number | null | undefined): boolean => status === 3;

/** Zibal rejects anything at or below 1,000 Rial with result 105. */
export const MIN_AMOUNT_RIAL = 1_000;

/** Zibal's public sandbox merchant. Real money never moves through it. */
export const SANDBOX_MERCHANT = 'zibal';

// --- Verify decision -------------------------------------------------------

export type VerifyLike = {
  result: number;
  status?: number;
  amount?: number;
};

export type VerifyDecision =
  | { kind: 'paid'; alreadyVerified: boolean }
  | { kind: 'amount-mismatch'; charged: number; expected: number }
  | { kind: 'canceled' }
  | { kind: 'failed' };

/**
 * The whole "did we get the money?" rule, in one pure function.
 *
 * 100 = verified now, 201 = verified earlier; both mean the money moved, so a
 * duplicate verification of a real payment is still a payment. Everything else
 * is not - and a paid result whose amount does not match the order is treated
 * as a failure rather than as money, because the only ways that happens are a
 * replayed trackId or a tampered session.
 *
 * `expectedRial` comes from our own stored payment row, never from the request.
 */
export function decideVerification(data: VerifyLike, expectedRial: number): VerifyDecision {
  if (data.result !== 100 && data.result !== 201) {
    return isCanceledStatus(data.status) ? { kind: 'canceled' } : { kind: 'failed' };
  }
  // Zibal omits `amount` on some responses; absence cannot prove a mismatch.
  if (typeof data.amount === 'number' && data.amount !== expectedRial) {
    return { kind: 'amount-mismatch', charged: data.amount, expected: expectedRial };
  }
  return { kind: 'paid', alreadyVerified: data.result === 201 };
}

/** trackIds are digits. Anything else in a callback URL is not one of ours. */
export const isTrackId = (v: string | null | undefined): v is string =>
  typeof v === 'string' && /^\d{1,20}$/.test(v);

/** An amount Zibal will accept: a positive integer Rial above the minimum. */
export const isPayableAmount = (rial: number): boolean =>
  Number.isInteger(rial) && rial > MIN_AMOUNT_RIAL;

// --- Response normalisation ------------------------------------------------
//
// Both of these exist because of what the live gateway actually returns, which
// is not quite what a reading of the docs suggests.

/**
 * Zibal fills unknown string fields with "-" rather than omitting them or
 * sending null (observed on cardNumber and iban for an unpaid transaction).
 * Stored as-is, that renders as a card number of "-" on the receipt.
 */
export function cleanField(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' || trimmed === '-' ? null : trimmed;
}

/**
 * Zibal timestamps look like "2026-08-22T19:00:52.684000": ISO-shaped, but with
 * no timezone designator and microsecond precision. `new Date()` reads a
 * designator-less string as *server-local* time, so on a UTC container a Tehran
 * timestamp silently shifts by 3.5 hours - the receipt then shows the wrong
 * time, and a paidAt can appear to precede the order it belongs to.
 *
 * Tehran has been a fixed UTC+03:30 since 2022 (no DST), so the offset is
 * appended explicitly. A value that already carries a designator is respected.
 */
const TEHRAN_OFFSET = '+03:30';

export function parseGatewayDate(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw || raw === '-') return null;

  // Already has Z or ±hh:mm -> trust it.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  // Trim microseconds to milliseconds; Date ignores the extra digits anyway,
  // but the explicit form keeps the appended offset unambiguous.
  const normalized = raw.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1');
  const d = new Date(hasZone ? normalized : `${normalized}${TEHRAN_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;

  // A Jalali-style "1405/06/01" parses to a year-1405 Date rather than failing.
  // Anything outside a sane window is a value we do not understand.
  const year = d.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? d.toISOString() : null;
}

// --- Inquiry decision ------------------------------------------------------

export type InquiryDecision =
  | { kind: 'paid' }
  | { kind: 'amount-mismatch'; charged: number; expected: number }
  | { kind: 'awaiting' }
  | { kind: 'canceled' }
  | { kind: 'failed' }
  | { kind: 'query-failed' };

/**
 * The same question as decideVerification, but for /v1/inquiry - and the two
 * are NOT interchangeable.
 *
 * On /v1/verify, result 100 means "this payment is verified". On /v1/inquiry,
 * result 100 only means "the lookup worked"; the payment's real state is in
 * `status`. Feeding an inquiry response to the verify rule therefore reads
 * every successful lookup as a successful payment - including a transaction
 * sitting at status -1, never paid at all.
 *
 * status -1 (awaiting payment) is kept distinct from failure: an admin looking
 * up a payment the customer has not finished yet must not turn it into a
 * failure and take the retry option away from them.
 */
export function decideInquiry(data: VerifyLike, expectedRial: number): InquiryDecision {
  if (data.result !== 100) return { kind: 'query-failed' };

  if (isPaidStatus(data.status)) {
    if (typeof data.amount === 'number' && data.amount !== expectedRial) {
      return { kind: 'amount-mismatch', charged: data.amount, expected: expectedRial };
    }
    return { kind: 'paid' };
  }

  if (data.status === -1) return { kind: 'awaiting' };
  if (isCanceledStatus(data.status)) return { kind: 'canceled' };
  return { kind: 'failed' };
}
