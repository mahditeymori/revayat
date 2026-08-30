'use server';

// Starts a fresh Zibal session for an existing unpaid order without sending
// the customer back through the checkout form. Amount is always read from
// the stored order (startPayment reads orders.totalRial itself) — never from
// anything the request could supply.
import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/commerce/orders';
import { startPayment } from '@/lib/zibal/payment-flow';

export async function retryPaymentAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get('orderId'));
  if (!Number.isInteger(orderId) || orderId <= 0) redirect('/cart');

  const order = await getOrder(orderId);
  if (!order) redirect('/cart');
  if (order.paymentStatus === 'paid') redirect(`/payment/result?order=${order.id}`);

  const payment = await startPayment(order.id, order.shipping.phone);
  if (!payment.ok) {
    redirect(`/payment/failed?order=${order.id}&reason=${encodeURIComponent(payment.message)}`);
  }
  redirect(payment.startUrl);
}
