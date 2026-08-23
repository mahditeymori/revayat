// Zibal payment gateway REST client (https://gateway.zibal.ir).
//
// SERVER ONLY. The merchant id is a credential: it authorises money to be
// requested into our account, so it lives in ZIBAL_MERCHANT and is never
// prefixed NEXT_PUBLIC_ - that would inline it into the browser bundle.
// Nothing in this file may be imported from a 'use client' component.
//
// Money is integer Rial everywhere, matching the rest of the codebase
// (see format.ts) - Zibal's `amount` is also Rial, so no conversion happens.
import 'server-only';
import {
  SANDBOX_MERCHANT,
  isPayableAmount,
  resultMessage,
} from './zibal-codes.ts';

// The code tables and the pure verify decision live in zibal-codes.ts so they
// stay testable without a request scope; re-exported here so callers need only
// this module.
export * from './zibal-codes.ts';

const BASE = 'https://gateway.zibal.ir';

const TIMEOUT_MS = 20_000;

// --- Wire types ------------------------------------------------------------

export type ZibalRequestInput = {
  amountRial: number;
  orderId: string;
  description: string;
  mobile?: string;
  callbackUrl: string;
};

export type ZibalRequestResponse = {
  result: number;
  trackId?: number;
  message?: string;
};

export type ZibalVerifyResponse = {
  result: number;
  status?: number;
  amount?: number;
  refNumber?: number | string | null;
  cardNumber?: string | null;
  paidAt?: string | null;
  orderId?: string | null;
  description?: string | null;
  message?: string;
};

export type ZibalInquiryResponse = ZibalVerifyResponse & {
  createdAt?: string | null;
  wage?: number;
};

/** Every call returns this shape - network failures become ok:false, never a throw. */
export type ZibalCall<T> =
  | { ok: true; data: T }
  | { ok: false; result: number | null; message: string };

// --- Configuration ---------------------------------------------------------

/**
 * Throws when unset rather than defaulting to the sandbox merchant: a
 * production deploy silently falling back to `zibal` would mark orders paid
 * while no money ever moved. Callers catch this and show a configuration error.
 */
export function merchantId(): string {
  const id = process.env.ZIBAL_MERCHANT?.trim();
  if (!id) throw new Error('ZIBAL_MERCHANT is not set - the payment gateway is not configured.');
  return id;
}

export const isConfigured = (): boolean => Boolean(process.env.ZIBAL_MERCHANT?.trim());

export const isSandbox = (): boolean => process.env.ZIBAL_MERCHANT?.trim() === SANDBOX_MERCHANT;

// --- Transport -------------------------------------------------------------

/** Payment failures are money problems - they always reach the container logs. */
function logError(path: string, message: string, err?: unknown): void {
  console.error(`[zibal] ${path}: ${message}`, err instanceof Error ? err.message : (err ?? ''));
}

async function post<T extends { result: number; message?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<ZibalCall<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'درگاه پرداخت پاسخ نداد (اتمام زمان انتظار).'
        : 'ارتباط با درگاه پرداخت برقرار نشد.';
    logError(path, message, err);
    return { ok: false, result: null, message };
  }

  if (!res.ok) {
    const message = `درگاه پرداخت خطای ${res.status} برگرداند.`;
    logError(path, message);
    return { ok: false, result: null, message };
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch (err) {
    const message = 'پاسخ درگاه پرداخت قابل خواندن نبود.';
    logError(path, message, err);
    return { ok: false, result: null, message };
  }

  if (typeof data?.result !== 'number') {
    const message = 'پاسخ درگاه پرداخت ساختار معتبری نداشت.';
    logError(path, message);
    return { ok: false, result: null, message };
  }

  return { ok: true, data };
}

/** Guard shared by all three calls - a missing merchant is a config bug, not a user error. */
function withMerchant(path: string): { merchant: string } | ZibalCall<never> {
  try {
    return { merchant: merchantId() };
  } catch (err) {
    logError(path, 'ZIBAL_MERCHANT missing', err);
    return { ok: false, result: null, message: 'درگاه پرداخت پیکربندی نشده است.' };
  }
}

// --- API -------------------------------------------------------------------

/**
 * Step 1 - create the payment session. result 100 means the trackId is usable;
 * anything else is a configuration or amount problem on our side.
 */
export async function requestPayment(
  input: ZibalRequestInput,
): Promise<ZibalCall<ZibalRequestResponse>> {
  const m = withMerchant('/v1/request');
  if ('ok' in m) return m;

  if (!isPayableAmount(input.amountRial)) {
    return { ok: false, result: 105, message: resultMessage(105) };
  }

  if (isSandbox()) {
    console.warn('[zibal] using the SANDBOX merchant "zibal" - no real money will be transferred.');
  }

  const call = await post<ZibalRequestResponse>('/v1/request', {
    merchant: m.merchant,
    amount: input.amountRial,
    callbackUrl: input.callbackUrl,
    orderId: input.orderId,
    description: input.description.slice(0, 250),
    // Zibal only accepts a bare 09xxxxxxxxx; anything else fails the request.
    ...(input.mobile && /^09\d{9}$/.test(input.mobile) ? { mobile: input.mobile } : {}),
  });

  if (!call.ok) return call;
  if (call.data.result !== 100 || !call.data.trackId) {
    logError('/v1/request', `result=${call.data.result} ${call.data.message ?? ''}`);
    return { ok: false, result: call.data.result, message: resultMessage(call.data.result) };
  }
  return call;
}

/** Step 2 - where the browser is sent to actually pay. */
export const startUrl = (trackId: string | number): string => `${BASE}/start/${trackId}`;

/**
 * Step 4 - the only statement about a payment we trust. The callback's
 * `success=1` is attacker-controllable (it is a plain GET on a public URL);
 * this response is not.
 */
export async function verifyPayment(
  trackId: string | number,
): Promise<ZibalCall<ZibalVerifyResponse>> {
  const m = withMerchant('/v1/verify');
  if ('ok' in m) return m;
  return post<ZibalVerifyResponse>('/v1/verify', { merchant: m.merchant, trackId: toTrackId(trackId) });
}

/**
 * Step 5 - read-only status lookup. Unlike verify it has no side effect, so it
 * is safe to call repeatedly: used to reconcile a payment whose callback never
 * arrived, and from the admin panel's inquiry button.
 */
export async function inquirePayment(
  trackId: string | number,
): Promise<ZibalCall<ZibalInquiryResponse>> {
  const m = withMerchant('/v1/inquiry');
  if ('ok' in m) return m;
  return post<ZibalInquiryResponse>('/v1/inquiry', { merchant: m.merchant, trackId: toTrackId(trackId) });
}

/** trackIds are numeric, but sent as-is if they ever stop being - never NaN. */
const toTrackId = (v: string | number): string | number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : String(v);
};
