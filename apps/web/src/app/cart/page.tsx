'use client';

// The full review page renders from the exact same CartProvider context as
// the drawer — not a second fetch of its own — so the two can never drift.
// Cart contents are per-visitor and already excluded from indexing
// (robots.ts, and noindex below), so a client-rendered page here trades
// nothing away on SEO.
import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { CartItemRow } from './CartItemRow';
import { EmptyCartState } from '@/components/cart/EmptyCartState';
import { formatToman } from '@/lib/format';

export default function CartPage() {
  const { cart, loading, error } = useCart();

  if (loading && cart.items.length === 0) {
    return (
      <div className="flex min-h-[50svh] items-center justify-center" role="status" aria-live="polite">
        <p className="text-sm text-ink-60">در حال بارگذاری سبد خرید…</p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl font-medium">سبد خرید</h1>
        <EmptyCartState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">سبد خرید</h1>
      {error && (
        <p role="alert" className="mt-4 text-xs text-clay">
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="border-t border-cream-200">
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} />
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
              <dd>{formatToman(cart.subtotal.amount)}</dd>
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
