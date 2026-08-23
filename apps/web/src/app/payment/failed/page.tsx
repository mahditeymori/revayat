// Every unhappy payment path lands here: cancelled, declined, gateway down, or
// a verify that never completed. The order still exists, so the customer can
// retry without re-entering the form - retryPaymentAction creates a fresh Zibal
// session for the same order.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPaymentByTrackId } from '@/lib/payments';
import { getOrder, orderPaymentState } from '@/lib/catalog';
import { formatToman, toPersianDigits } from '@/lib/format';
import { retryPaymentAction } from '../actions';

export const metadata: Metadata = { title: 'پرداخت ناموفق', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ trackId?: string; order?: string; reason?: string }>;
}) {
  const { trackId, order: orderParam, reason } = await searchParams;

  const payment = trackId ? await getPaymentByTrackId(trackId) : null;
  const orderId = payment?.orderId ?? (orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : null);
  const order = orderId ? await getOrder(orderId) : null;

  // The stored error is authoritative; `reason` only covers failures that
  // happened before a payment row existed (e.g. the gateway refused the request).
  const message =
    payment?.errorMessage ??
    (reason ? reason.slice(0, 300) : null) ??
    'پرداخت شما کامل نشد.';

  // An order that did get paid on a later attempt should not be shown a retry
  // button - point at the receipt instead.
  const alreadyPaid = order ? orderPaymentState(order) === 'paid' : false;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center">
      <h1 className="text-2xl font-medium text-clay">پرداخت ناموفق بود</h1>
      <p role="alert" className="mt-5 max-w-sm text-sm leading-7 text-ink-60">
        {message}
      </p>

      {(order || payment) && (
        <dl className="mt-8 w-full space-y-3 border border-cream-200 p-6 text-sm">
          {orderId && <Row label="شماره سفارش" value={toPersianDigits(orderId)} />}
          {order && <Row label="مبلغ سفارش" value={formatToman(order.totalRial)} />}
          {payment && <Row label="شناسه پیگیری" value={toPersianDigits(payment.trackId)} />}
        </dl>
      )}

      <p className="mt-6 text-xs leading-6 text-ink-60">
        اگر مبلغی از حساب شما کسر شده، طی حداکثر ۷۲ ساعت به‌صورت خودکار بازمی‌گردد.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {order && !alreadyPaid && (
          <form action={retryPaymentAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" className="bg-ink px-8 py-3 text-sm text-cream hover:bg-sand-dark">
              تلاش دوباره برای پرداخت
            </button>
          </form>
        )}
        {alreadyPaid && order?.paidTrackId && (
          <Link
            href={`/payment/result?trackId=${encodeURIComponent(order.paidTrackId)}`}
            className="bg-ink px-8 py-3 text-sm text-cream hover:bg-sand-dark"
          >
            مشاهده رسید پرداخت
          </Link>
        )}
        <Link href="/cart" className="border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
          بازگشت به سبد خرید
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-60">{label}</dt>
      <dd dir="ltr" className="font-medium">{value}</dd>
    </div>
  );
}
