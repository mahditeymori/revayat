// Payment records: one row per attempt to pay for an order, stored in
// DATA_DIR/payments.json alongside the rest of the JSON data store.
//
// A payment row is the audit trail. It is written BEFORE the user leaves for
// the bank (status 'pending'), so a payment that never comes back is still
// visible in the admin panel rather than vanishing. Nothing here ever deletes
// a row - a failed payment is evidence, not garbage.
import 'server-only';
import { mutate, readJson } from './store.ts';

const FILE = 'payments.json';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled';

export type Payment = {
  id: string;
  orderId: number;
  trackId: string;
  gateway: 'zibal';
  amountRial: number;
  status: PaymentStatus;
  /** Zibal refNumber - the bank's reference for the transaction. */
  transactionId: string | null;
  /** Masked PAN as returned by Zibal (e.g. 621986******1234). Never a full card number. */
  cardNumber: string | null;
  /** ISO timestamp of the moment the bank reports the money moved. */
  paymentDate: string | null;
  errorMessage: string | null;
  /** Zibal `result` from the last request/verify call. */
  resultCode: number | null;
  /** Zibal transaction `status` from the last verify/inquiry call. */
  statusCode: number | null;
  createdAt: string;
  updatedAt: string;
  /** True once /v1/verify has returned 100 or 201 - the duplicate-verify guard. */
  verified: boolean;
};

export const listPayments = (): Promise<Payment[]> => readJson<Payment[]>(FILE, [], 'payments');

export async function getPaymentByTrackId(trackId: string): Promise<Payment | null> {
  const all = await listPayments();
  return all.find((p) => p.trackId === String(trackId)) ?? null;
}

export async function getPaymentsForOrder(orderId: number): Promise<Payment[]> {
  const all = await listPayments();
  return all.filter((p) => p.orderId === orderId);
}

/** Has this order already been paid for? Guards against paying twice. */
export async function orderIsPaid(orderId: number): Promise<boolean> {
  const all = await listPayments();
  return all.some((p) => p.orderId === orderId && p.status === 'paid');
}

export async function createPayment(input: {
  orderId: number;
  trackId: string | number;
  amountRial: number;
}): Promise<Payment> {
  const now = new Date().toISOString();
  const payment: Payment = {
    // trackId is unique per Zibal payment session, so it doubles as the row id.
    id: `zibal-${input.trackId}`,
    orderId: input.orderId,
    trackId: String(input.trackId),
    gateway: 'zibal',
    amountRial: input.amountRial,
    status: 'pending',
    transactionId: null,
    cardNumber: null,
    paymentDate: null,
    errorMessage: null,
    resultCode: 100,
    statusCode: null,
    createdAt: now,
    updatedAt: now,
    verified: false,
  };
  return mutate<Payment[], Payment>(FILE, [], (all) => [[...all, payment], payment], 'payments');
}

export type PaymentPatch = Partial<Omit<Payment, 'id' | 'orderId' | 'trackId' | 'gateway' | 'createdAt'>>;

/** Returns the updated row, or null when no row has that trackId. */
export function updatePayment(trackId: string, patch: PaymentPatch): Promise<Payment | null> {
  return mutate<Payment[], Payment | null>(
    FILE,
    [],
    (all) => {
      const idx = all.findIndex((p) => p.trackId === String(trackId));
      if (idx === -1) return [all, null];
      const updated: Payment = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
      const next = all.slice();
      next[idx] = updated;
      return [next, updated];
    },
    'payments',
  );
}

/**
 * Claim the right to verify this payment, atomically.
 *
 * Zibal can hit the callback more than once (browser back button, a retried
 * redirect, a hand-crafted GET). Without this, two concurrent callbacks would
 * both see `verified: false`, both call /v1/verify, and the second would get
 * result 201 - harmless there, but the same race on the order side would run
 * the "mark paid" work twice. Only the caller that flips the flag proceeds.
 *
 * `already` distinguishes "someone else is handling it" from "no such payment".
 */
export function claimVerification(
  trackId: string,
): Promise<{ payment: Payment | null; claimed: boolean }> {
  return mutate<Payment[], { payment: Payment | null; claimed: boolean }>(
    FILE,
    [],
    (all) => {
      const idx = all.findIndex((p) => p.trackId === String(trackId));
      if (idx === -1) return [all, { payment: null, claimed: false }];
      const current = all[idx];
      if (current.verified) return [all, { payment: current, claimed: false }];
      const next = all.slice();
      next[idx] = { ...current, verified: true, updatedAt: new Date().toISOString() };
      return [next, { payment: next[idx], claimed: true }];
    },
    'payments',
  );
}

/** Release a claim taken by claimVerification when the verify call never landed. */
export const releaseVerification = (trackId: string): Promise<Payment | null> =>
  updatePayment(trackId, { verified: false });

// --- Reporting -------------------------------------------------------------

export type PaymentTotals = { all: number; paid: number; pending: number; failed: number; canceled: number; paidRial: number };

export function totals(payments: Payment[]): PaymentTotals {
  const sum: PaymentTotals = { all: payments.length, paid: 0, pending: 0, failed: 0, canceled: 0, paidRial: 0 };
  for (const p of payments) {
    sum[p.status] += 1;
    if (p.status === 'paid') sum.paidRial += p.amountRial;
  }
  return sum;
}
