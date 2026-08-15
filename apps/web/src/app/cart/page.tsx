import type { Metadata } from 'next';
import Link from 'next/link';
import { getCart } from '@/lib/cart';
import { formatToman } from '@/lib/format';
import { CartItemRow } from './CartItemRow';

export const metadata: Metadata = { title: 'سبد خرید', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getCart();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
        <h1 className="text-2xl font-medium">سبد خرید خالی است</h1>
        <p className="mt-4 text-sm text-ink-60">هنوز محصولی به سبد اضافه نکرده‌اید.</p>
        <Link href="/collections" className="mt-10 border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
          دیدن مجموعه‌ها
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">سبد خرید</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="border-t border-cream-200">
          {cart.items.map((item) => (
            <CartItemRow key={item.key} item={item} />
          ))}
        </ul>

        <aside className="h-max border border-cream-200 p-6 lg:sticky lg:top-24">
          <h2 className="text-sm font-medium">خلاصه سفارش</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-60">تعداد اقلام</dt>
              <dd>{cart.itemCount}</dd>
            </div>
            <div className="flex justify-between border-t border-cream-200 pt-3 text-base font-medium">
              <dt>جمع کل</dt>
              <dd>{formatToman(cart.totalRial)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-60">هزینه ارسال پس از ثبت سفارش هماهنگ می‌شود.</p>
          <Link
            href="/checkout"
            className="mt-6 block bg-ink py-4 text-center text-sm text-cream transition-colors hover:bg-sand-dark"
          >
            ادامه و ثبت سفارش
          </Link>
        </aside>
      </div>
    </div>
  );
}
