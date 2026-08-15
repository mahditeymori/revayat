import type { Metadata } from 'next';
import Link from 'next/link';
import { toPersianDigits } from '@/lib/format';

export const metadata: Metadata = { title: 'سفارش ثبت شد', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="wordmark text-xs text-ink-60">سپاس از شما</p>
      <h1 className="mt-6 text-2xl font-medium">سفارش شما ثبت شد</h1>
      {order && (
        <p className="mt-4 text-sm text-ink-60">
          شماره سفارش: <span className="font-medium text-ink">{toPersianDigits(order)}</span>
        </p>
      )}
      <p className="mt-4 max-w-sm text-sm leading-7 text-ink-60">
        برای هماهنگی پرداخت و ارسال، به‌زودی با شماره‌ای که ثبت کرده‌اید تماس می‌گیریم.
      </p>
      <Link href="/collections" className="mt-10 border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
        ادامه خرید
      </Link>
    </div>
  );
}
