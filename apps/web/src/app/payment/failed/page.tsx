export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/commerce/orders';
import { retryPaymentAction } from '../actions';

type Props = { searchParams: Promise<{ order?: string; reason?: string }> };

export default async function PaymentFailedPage({ searchParams }: Props) {
  const { order: orderParam, reason } = await searchParams;
  const orderId = Number(orderParam);
  const order = Number.isInteger(orderId) && orderId > 0 ? await getOrder(orderId) : null;

  // A different attempt on this order already succeeded — the failure this
  // page would show is stale, so send the customer to the real receipt.
  if (order?.paymentStatus === 'paid') redirect(`/payment/result?order=${order.id}`);

  const message = reason || 'پرداخت انجام نشد.';

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <div className="border border-clay/40 bg-clay/5 p-8">
        <p className="text-lg font-medium text-clay">پرداخت ناموفق بود</p>
        <p className="mt-2 text-sm text-ink-60">{message}</p>
      </div>

      {order ? (
        <form action={retryPaymentAction} className="mt-8">
          <input type="hidden" name="orderId" value={order.id} />
          <button
            type="submit"
            className="w-full bg-ink py-4 text-center text-sm text-cream transition-colors hover:bg-sand-dark"
          >
            تلاش دوباره برای پرداخت
          </button>
        </form>
      ) : (
        <Link
          href="/cart"
          className="mt-8 block bg-ink py-4 text-center text-sm text-cream transition-colors hover:bg-sand-dark"
        >
          بازگشت به سبد خرید
        </Link>
      )}
    </div>
  );
}
