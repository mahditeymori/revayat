// Receipt page. Reached only via redirect from /payment/callback, and rendered
// from the stored payment row rather than from the query string - the trackId
// in the URL is just a lookup key, so a guessed one shows nothing useful.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPaymentByTrackId } from '@/lib/payments';
import { getOrder } from '@/lib/catalog';
import { formatToman, formatJalali, toPersianDigits } from '@/lib/format';

export const metadata: Metadata = { title: 'رسید پرداخت', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ trackId?: string }>;
}) {
  const { trackId } = await searchParams;
  const payment = trackId ? await getPaymentByTrackId(trackId) : null;

  // Not paid (or not ours) - the failure page owns every unhappy path, so
  // there is exactly one place that explains what went wrong.
  if (!payment || payment.status !== 'paid') {
    redirect(`/payment/failed${trackId ? `?trackId=${encodeURIComponent(trackId)}` : ''}`);
  }

  const order = await getOrder(payment.orderId);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center">
      <p className="wordmark text-xs text-ink-60">سپاس از شما</p>
      <h1 className="mt-6 text-2xl font-medium">پرداخت با موفقیت انجام شد</h1>
      <p className="mt-4 max-w-sm text-sm leading-7 text-ink-60">
        سفارش شما ثبت و پرداخت آن تأیید شد. برای هماهنگی ارسال با شما تماس می‌گیریم.
      </p>

      <dl className="mt-10 w-full space-y-3 border border-cream-200 p-6 text-sm">
        <Row label="شماره سفارش" value={toPersianDigits(payment.orderId)} />
        <Row label="مبلغ پرداخت‌شده" value={formatToman(payment.amountRial)} />
        <Row label="شناسه پیگیری" value={toPersianDigits(payment.trackId)} />
        {payment.transactionId && (
          <Row label="شماره مرجع بانکی" value={toPersianDigits(payment.transactionId)} />
        )}
        {payment.cardNumber && <Row label="شماره کارت" value={toPersianDigits(payment.cardNumber)} />}
        {payment.paymentDate && <Row label="تاریخ پرداخت" value={formatJalali(payment.paymentDate)} />}
      </dl>

      <p className="mt-6 text-xs leading-6 text-ink-60">
        شناسه پیگیری را تا زمان دریافت سفارش نگه دارید.
      </p>

      {order && order.items.length > 0 && (
        <ul className="mt-8 w-full space-y-2 text-right text-xs text-ink-60">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {item.name} ({item.size}) × {toPersianDigits(item.quantity)}
              </span>
              <span>{formatToman(item.priceRial * item.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/collections"
        className="mt-10 border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream"
      >
        ادامه خرید
      </Link>
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
