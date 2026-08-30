// Reached only via the 303 redirect from /payment/callback (or a direct link
// to a genuinely paid order's receipt) — never trusts a guessed order id as
// proof of payment: an order whose paymentStatus isn't 'paid' is bounced to
// the failure page instead of rendering a receipt for money never received.
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/commerce/orders';
import { getSucceededPayment } from '@/lib/zibal/payment-flow';
import { formatToman, toPersianDigits } from '@/lib/format';

type Props = { searchParams: Promise<{ order?: string }> };

export default async function PaymentResultPage({ searchParams }: Props) {
  const { order: orderParam } = await searchParams;
  const orderId = Number(orderParam);
  if (!Number.isInteger(orderId) || orderId <= 0) redirect('/cart');

  const order = await getOrder(orderId);
  if (!order) redirect('/cart');
  if (order.paymentStatus !== 'paid') redirect(`/payment/failed?order=${order.id}`);

  const payment = await getSucceededPayment(order.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="border border-cream-200 p-8 text-center">
        <p className="text-lg font-medium">پرداخت با موفقیت انجام شد</p>
        <p className="mt-2 text-sm text-ink-60">شماره سفارش: {toPersianDigits(order.id)}</p>
      </div>

      <div className="mt-8 border border-cream-200 p-6">
        <h2 className="text-sm font-medium">اقلام سفارش</h2>
        <ul className="mt-4 space-y-2 border-t border-cream-200 pt-4 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span>
                {item.productName}
                {item.variantTitle && item.variantTitle !== 'Default' ? ` — ${item.variantTitle}` : ''} ×{' '}
                {toPersianDigits(item.quantity)}
              </span>
              <span>{formatToman(item.unitPrice.amount * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-cream-200 pt-4 text-sm">
          {order.discount.amount > 0 && (
            <div className="flex justify-between text-ink-60">
              <dt>تخفیف</dt>
              <dd>-{formatToman(order.discount.amount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-medium">
            <dt>جمع کل پرداخت‌شده</dt>
            <dd>{formatToman(order.total.amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 border border-cream-200 p-6 text-sm">
        <h2 className="text-sm font-medium">اطلاعات ارسال</h2>
        <dl className="mt-4 space-y-2 text-ink-60">
          <div className="flex justify-between">
            <dt>گیرنده</dt>
            <dd className="text-ink">{order.shipping.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt>موبایل</dt>
            <dd dir="ltr" className="text-ink">
              {order.shipping.phone}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>آدرس</dt>
            <dd className="text-ink">{order.shipping.address}</dd>
          </div>
        </dl>
      </div>

      {payment?.gatewayRefNumber && (
        <p className="mt-6 text-center text-xs text-ink-60">
          کد پیگیری تراکنش: <span dir="ltr">{payment.gatewayRefNumber}</span>
        </p>
      )}

      <Link
        href="/collections"
        className="mt-8 block bg-ink py-4 text-center text-sm text-cream transition-colors hover:bg-sand-dark"
      >
        بازگشت به فروشگاه
      </Link>
    </div>
  );
}
