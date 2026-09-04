'use client';

// Replaces a plain <Link href="/cart"> in the header: opens the drawer for
// quick view/edit when JS has hydrated, and degrades to a real navigation to
// /cart if it hasn't (progressive enhancement, no different than a normal link).
import Link from 'next/link';
import { useCart } from './CartProvider';
import { CartIcon } from '@/components/CartIcon';
import { toPersianDigits } from '@/lib/format';

export function CartTrigger() {
  const { cart, open } = useCart();
  return (
    <Link
      href="/cart"
      onClick={(e) => {
        e.preventDefault();
        open();
      }}
      className="group relative flex items-center hover:opacity-75"
      aria-label={`سبد خرید${cart.itemCount > 0 ? ` (${toPersianDigits(cart.itemCount)} کالا)` : ''}`}
    >
      <CartIcon />
      {cart.itemCount > 0 && (
        <span
          aria-hidden
          className="absolute -start-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none text-cream"
        >
          {toPersianDigits(cart.itemCount)}
        </span>
      )}
    </Link>
  );
}
