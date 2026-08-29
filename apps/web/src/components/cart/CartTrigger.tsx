'use client';

// Replaces the plain <Link href="/cart"> in the header: opens the drawer for
// quick view/edit when JS has hydrated, and degrades to a real navigation to
// /cart if it hasn't (progressive enhancement, no different than a normal link).
import Link from 'next/link';
import { useCart } from './CartProvider';
import { CartIcon } from '@/components/CartIcon';
import { CartBadge } from '@/components/CartBadge';

export function CartTrigger() {
  const { open } = useCart();
  return (
    <Link
      href="/cart"
      onClick={(e) => {
        e.preventDefault();
        open();
      }}
      className="relative flex items-center hover:opacity-75"
      aria-label="سبد خرید"
    >
      <CartIcon />
      <CartBadge />
    </Link>
  );
}
