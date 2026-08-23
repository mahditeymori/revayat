'use server';

import { redirect } from 'next/navigation';
import { getOrder, orderPaymentState } from '@/lib/catalog';
import { startPayment } from '@/lib/payment-flow';
import { callbackUrl } from '@/lib/zibal-callback-url';
import { normalizeDigits } from '@/lib/format';

/**
 * Retry a failed payment for an existing order: a new Zibal session against the
 * same order, so the customer does not re-enter the checkout form.
 *
 * The order id is public (it is in the failure URL), so this deliberately does
 * nothing sensitive: it can only start a payment for an order that already
 * exists and is not yet paid, and the amount always comes from the stored order
 * rather than from the request. Worst case, a stranger generates a payment link
 * for someone else's unpaid order - which only helps that order get paid.
 */
export async function retryPaymentAction(formData: FormData): Promise<void> {
  const id = Number(normalizeDigits(String(formData.get('orderId') ?? '')));
  if (!Number.isInteger(id) || id <= 0) redirect('/cart');

  const order = await getOrder(id);
  if (!order) redirect('/cart');

  if (orderPaymentState(order) === 'paid') {
    redirect(
      order.paidTrackId
        ? `/payment/result?trackId=${encodeURIComponent(order.paidTrackId)}`
        : '/cart',
    );
  }

  const payment = await startPayment(order, await callbackUrl());
  if (!payment.ok) {
    redirect(`/payment/failed?order=${order.id}&reason=${encodeURIComponent(payment.message)}`);
  }
  redirect(payment.redirectUrl);
}
