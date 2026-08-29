'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { formatToman, toPersianDigits } from '@/lib/format';
import type { CartItem } from '@/lib/cart';

export function CartDrawerRow({ item }: { item: CartItem }) {
  const { setQty, remove, close } = useCart();
  const [pending, startTransition] = useTransition();
  const image = item.product.images[0];

  function changeQty(next: number) {
    if (next < 1 || next > 99 || pending) return;
    startTransition(() => setQty(item.key, next));
  }

  function handleRemove() {
    if (pending) return;
    startTransition(() => remove(item.key));
  }

  return (
    <li className="flex gap-3 border-b border-cream-200 py-5">
      {image && (
        <Link
          href={`/products/${item.product.slug}`}
          onClick={close}
          className="relative block h-20 w-16 shrink-0 overflow-hidden bg-cream-200"
        >
          <Image src={image} alt={item.product.name} fill sizes="64px" className="object-cover" />
        </Link>
      )}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={`/products/${item.product.slug}`}
              onClick={close}
              className="text-sm font-medium hover:text-sand-dark"
            >
              {item.product.name}
            </Link>
            <p className="mt-1 text-xs text-ink-60">
              سایز: {item.size}
              {item.color && ` / رنگ: ${item.color}`}
            </p>
          </div>
          <p className="text-sm">{formatToman(item.lineTotalRial)}</p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-cream-200">
            <button
              type="button"
              onClick={() => changeQty(item.quantity - 1)}
              disabled={pending}
              aria-label="کاهش تعداد"
              className="h-7 w-7 text-sm text-ink-60 hover:text-ink disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center text-xs">{toPersianDigits(item.quantity)}</span>
            <button
              type="button"
              onClick={() => changeQty(item.quantity + 1)}
              disabled={pending}
              aria-label="افزایش تعداد"
              className="h-7 w-7 text-sm text-ink-60 hover:text-ink disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="text-xs text-ink-60 underline hover:text-clay disabled:opacity-50"
          >
            حذف
          </button>
        </div>
      </div>
    </li>
  );
}
