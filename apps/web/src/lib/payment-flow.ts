// Orchestration between an order, the Zibal gateway, and the payment record.
//
// This is where "is this order actually paid?" is decided. The rules it
// enforces, in order of importance:
//
//   1. The callback is never believed. `success=1` arrives as a plain GET on a
//      public URL - anyone can type it. Only /v1/verify moves an order to paid.
//   2. The amount is re-checked against the order before the order is completed.
//      A verify reporting a different amount than we asked for is treated as a
//      failure and logged loudly, never as a successful payment.
//   3. Verification happens at most once per trackId, enforced by an atomic
//      claim in payments.ts, so repeated callbacks are safe.
import 'server-only';
import { getOrder, setOrderPaymentState, type Order } from './catalog.ts';
import {
  claimVerification,
  createPayment,
  getPaymentByTrackId,
  orderIsPaid,
  releaseVerification,
  updatePayment,
  type Payment,
} from './payments.ts';
import {
  cleanField,
  decideInquiry,
  decideVerification,
  parseGatewayDate,
  type InquiryDecision,
  type VerifyDecision,
  inquirePayment,
  requestPayment,
  resultMessage,
  startUrl,
  statusMessage,
  verifyPayment,
  type ZibalVerifyResponse,
} from './zibal.ts';
import { site } from './site.ts';

export type StartResult =
  | { ok: true; redirectUrl: string; trackId: string }
  | { ok: false; message: string };

/**
 * Step 1+2 - create a Zibal session for an existing order and return where to
 * send the browser. The payment row is written before the redirect so an
 * abandoned payment is still visible in the admin panel.
 *
 * `callbackUrl` is passed in rather than derived here: it needs the live request
 * headers, and keeping that dependency at the call site leaves this module (and
 * the settle/verify logic below it) importable and testable without a request.
 */
export async function startPayment(order: Order, callbackUrl: string): Promise<StartResult> {
  if (await orderIsPaid(order.id)) {
    return { ok: false, message: 'این سفارش پیش‌تر پرداخت شده است.' };
  }

  const call = await requestPayment({
    amountRial: order.totalRial,
    orderId: String(order.id),
    description: `${site.nameFa} — سفارش ${order.id}`,
    mobile: order.customer.phone,
    callbackUrl,
  });

  if (!call.ok) {
    await setOrderPaymentState(order.id, 'failed');
    return { ok: false, message: call.message };
  }

  const trackId = String(call.data.trackId);
  await createPayment({ orderId: order.id, trackId, amountRial: order.totalRial });
  await setOrderPaymentState(order.id, 'awaiting');
  return { ok: true, redirectUrl: startUrl(trackId), trackId };
}

export type SettleOutcome = 'paid' | 'already-paid' | 'canceled' | 'failed' | 'unknown';

export type SettleResult = {
  outcome: SettleOutcome;
  message: string;
  payment: Payment | null;
  orderId: number | null;
};

/**
 * Step 3+4 - settle the payment behind a trackId. Safe to call repeatedly and
 * concurrently: the second caller sees the already-settled row and reports the
 * same outcome rather than re-verifying.
 */
export async function settlePayment(trackId: string): Promise<SettleResult> {
  const { payment, claimed } = await claimVerification(trackId);

  // A trackId with no row is either a forged callback or a session we never
  // created. Either way there is nothing to settle - and no order to touch.
  if (!payment) {
    console.error(`[payment] callback for unknown trackId ${trackId}`);
    return {
      outcome: 'unknown',
      message: 'این تراکنش در سامانه یافت نشد.',
      payment: null,
      orderId: null,
    };
  }

  // Someone already verified this trackId (repeated callback, browser back
  // button, or a concurrent request that won the claim). Report the settled
  // state instead of calling /v1/verify a second time.
  if (!claimed) {
    return { ...describe(payment), payment, orderId: payment.orderId };
  }

  const call = await verifyPayment(trackId);

  // The verify call itself failed to complete (network, timeout, 5xx). The
  // money may or may not have moved, so the claim is released and the row left
  // pending - the inquiry path reconciles it later.
  if (!call.ok) {
    await releaseVerification(trackId);
    await updatePayment(trackId, { errorMessage: call.message, resultCode: call.result });
    return {
      outcome: 'unknown',
      message: `${call.message} در صورت کسر وجه، مبلغ طی ۷۲ ساعت به حساب شما بازمی‌گردد.`,
      payment: await getPaymentByTrackId(trackId),
      orderId: payment.orderId,
    };
  }

  return applyVerification(payment, call.data, decideVerification(call.data, payment.amountRial));
}

/**
 * Turn a /v1/verify (or /v1/inquiry) response into a settled payment + order.
 *
 * The decision is passed in, not derived here: /v1/verify and /v1/inquiry
 * report success differently (see decideVerification vs decideInquiry), and
 * only the caller knows which endpoint answered. Everything below is the
 * bookkeeping the two share.
 */
async function applyVerification(
  payment: Payment,
  data: ZibalVerifyResponse,
  decision: VerifyDecision | InquiryDecision,
): Promise<SettleResult> {
  const { result, status } = data;
  const trackId = payment.trackId;

  // Existing values are kept when a response omits a field (or fills it with
  // the gateway's "-" placeholder), so a later inquiry cannot blank details a
  // successful verify already captured.
  const details = {
    transactionId: cleanField(data.refNumber != null ? String(data.refNumber) : null) ?? payment.transactionId,
    cardNumber: cleanField(data.cardNumber) ?? payment.cardNumber,
    paymentDate: parseGatewayDate(data.paidAt) ?? payment.paymentDate,
    resultCode: result,
    statusCode: status ?? payment.statusCode,
  };

  if (decision.kind === 'amount-mismatch') {
    const message = `مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد (${decision.charged} ≠ ${decision.expected} ریال).`;
    console.error(`[payment] amount mismatch on trackId ${trackId}: charged=${decision.charged} expected=${decision.expected}`);
    const updated = await updatePayment(trackId, { ...details, status: 'failed', errorMessage: message });
    await setOrderPaymentState(payment.orderId, 'failed');
    return { outcome: 'failed', message, payment: updated, orderId: payment.orderId };
  }

  if (decision.kind === 'paid') {
    const updated = await updatePayment(trackId, {
      ...details,
      status: 'paid',
      verified: true,
      errorMessage: null,
    });
    await setOrderPaymentState(payment.orderId, 'paid', {
      paidTrackId: trackId,
      paidAt: details.paymentDate ?? new Date().toISOString(),
    });
    return {
      // An inquiry-sourced 'paid' carries no alreadyVerified flag; a payment
      // reconciled that way was verified before this call either way.
      outcome: 'alreadyVerified' in decision && decision.alreadyVerified ? 'already-paid' : 'paid',
      message: 'پرداخت با موفقیت انجام شد.',
      payment: updated,
      orderId: payment.orderId,
    };
  }

  // Not paid. The claim stays set: re-verifying a failed trackId cannot turn it
  // into a success, and clearing it would let a repeated callback hammer the
  // gateway. A genuine retry creates a new trackId.
  const canceled = decision.kind === 'canceled';
  const message = canceled
    ? 'پرداخت توسط شما لغو شد.'
    : `${resultMessage(result)} ${statusMessage(status)}`.trim();

  console.error(`[payment] trackId ${trackId} not paid: result=${result} status=${status ?? '-'}`);

  const updated = await updatePayment(trackId, {
    ...details,
    status: canceled ? 'canceled' : 'failed',
    errorMessage: message,
  });
  await setOrderPaymentState(payment.orderId, 'failed');
  return {
    outcome: canceled ? 'canceled' : 'failed',
    message,
    payment: updated,
    orderId: payment.orderId,
  };
}

/**
 * Step 5 - reconcile a payment from /v1/inquiry rather than the callback. Used
 * for rows still pending because the user closed the tab on the bank page, and
 * from the admin panel. When the inquiry says the money moved, a real verify
 * still has to run - inquiry is read-only and never settles funds.
 */
export async function reconcilePayment(trackId: string): Promise<SettleResult> {
  const existing = await getPaymentByTrackId(trackId);
  if (!existing) {
    return { outcome: 'unknown', message: 'این تراکنش در سامانه یافت نشد.', payment: null, orderId: null };
  }

  const call = await inquirePayment(trackId);
  if (!call.ok) {
    await updatePayment(trackId, { errorMessage: call.message, resultCode: call.result });
    return { outcome: 'unknown', message: call.message, payment: existing, orderId: existing.orderId };
  }

  const data = call.data;
  const decision = decideInquiry(data, existing.amountRial);

  // The lookup itself failed (bad trackId, merchant problem). Nothing is known
  // about the payment, so nothing about it changes.
  if (decision.kind === 'query-failed') {
    const message = resultMessage(data.result);
    await updatePayment(trackId, { errorMessage: message, resultCode: data.result });
    return { outcome: 'unknown', message, payment: existing, orderId: existing.orderId };
  }

  // Still waiting for the customer at the bank. Deliberately NOT a failure:
  // marking it failed would strip the retry option from a payment that may yet
  // succeed, and the row is already 'pending'.
  if (decision.kind === 'awaiting') {
    const updated = await updatePayment(trackId, {
      statusCode: data.status ?? existing.statusCode,
      resultCode: data.result,
    });
    return {
      outcome: 'unknown',
      message: statusMessage(data.status) || 'این تراکنش هنوز پرداخت نشده است.',
      payment: updated,
      orderId: existing.orderId,
    };
  }

  // The money moved. Inquiry is read-only and never settles funds, so an
  // unverified payment still has to go through a real /v1/verify.
  if (decision.kind === 'paid' && !existing.verified) {
    return settlePayment(trackId);
  }

  // Everything else (already verified, cancelled, declined, amount mismatch)
  // is the same bookkeeping as a callback, so it shares that code path.
  return applyVerification(existing, data, decision);
}

/** The settled state of a payment row, without touching the gateway. */
function describe(payment: Payment): Omit<SettleResult, 'payment' | 'orderId'> {
  if (payment.status === 'paid') {
    return { outcome: 'already-paid', message: 'این پرداخت پیش‌تر با موفقیت تأیید شده است.' };
  }
  if (payment.status === 'canceled') {
    return { outcome: 'canceled', message: 'پرداخت توسط شما لغو شد.' };
  }
  if (payment.status === 'failed') {
    return { outcome: 'failed', message: payment.errorMessage ?? 'پرداخت ناموفق بود.' };
  }
  return { outcome: 'unknown', message: 'وضعیت این پرداخت هنوز مشخص نیست.' };
}

/** Convenience for the result pages: the order behind a settled payment. */
export const orderFor = (result: SettleResult): Promise<Order | null> =>
  result.orderId ? getOrder(result.orderId) : Promise.resolve(null);
