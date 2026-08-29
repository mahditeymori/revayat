'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { CartDrawerRow } from './CartDrawerRow';
import { EmptyCartIllustration } from './EmptyCartIllustration';
import { formatToman, toPersianDigits } from '@/lib/format';

export function CartDrawer() {
  const { cart, isOpen, close } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [isOpen, close]);

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-ink/40" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="سبد خرید"
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-cream shadow-[0_4px_24px_rgba(19,17,16,0.2)] transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
          <h2 className="text-sm font-medium">
            سبد خرید {cart ? `(${toPersianDigits(cart.itemCount)})` : ''}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="بستن سبد خرید"
            className="text-lg leading-none text-ink-60 hover:text-ink"
          >
            ×
          </button>
        </div>

        {!cart ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" role="status" aria-live="polite">
            <p className="text-sm text-ink-60">در حال بارگذاری سبد خرید... لطفاً منتظر بمانید</p>
            <span className="h-px w-32 overflow-hidden bg-cream-200">
              <span className="block h-full w-1/3 animate-brand-sweep bg-ink" />
            </span>
          </div>
        ) : cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <EmptyCartIllustration />
            <p className="mt-4 text-sm text-ink-60">سبد خرید شما خالی است.</p>
            <Link
              href="/collections"
              onClick={close}
              className="mt-6 border border-ink px-6 py-2.5 text-sm hover:bg-ink hover:text-cream"
            >
              دیدن مجموعه‌ها
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5">
              {cart.items.map((item) => (
                <CartDrawerRow key={item.key} item={item} />
              ))}
            </ul>
            <div className="border-t border-cream-200 px-5 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-60">جمع کل</span>
                <span className="font-medium">{formatToman(cart.totalRial)}</span>
              </div>
              <Link
                href="/checkout"
                onClick={close}
                className="mt-4 block bg-ink py-3.5 text-center text-sm text-cream transition-colors hover:bg-sand-dark"
              >
                تسویه حساب
              </Link>
              <Link
                href="/cart"
                onClick={close}
                className="mt-2 block border border-cream-200 py-3.5 text-center text-sm transition-colors hover:border-ink"
              >
                مشاهده سبد خرید
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
