'use client';

// Reads the non-httpOnly count cookie (set in lib/cart.ts) so the header can
// show a live badge while the layout stays static. Display-only value.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toPersianDigits } from '@/lib/format';
import { readCartCount } from '@/lib/cartCount';

export function CartBadge() {
  // starts at 0 on the server render — count appears after hydration
  const [count, setCount] = useState(0);
  // the root layout survives client navigations, so re-read per route too
  const pathname = usePathname();

  useEffect(() => {
    const update = () => setCount(readCartCount(document.cookie));
    update();
    window.addEventListener('cart:updated', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.removeEventListener('cart:updated', update);
      window.removeEventListener('pageshow', update);
    };
  }, [pathname]);

  if (count === 0) return null;
  return (
    <span
      aria-label={`${toPersianDigits(count)} کالا در سبد`}
      className="absolute -left-4 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none text-cream"
    >
      {toPersianDigits(count)}
    </span>
  );
}
