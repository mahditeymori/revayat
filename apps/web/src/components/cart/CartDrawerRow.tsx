'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { formatToman, toPersianDigits } from '@/lib/format';
import type { CartItem } from '@/lib/commerce/types';

export function CartDrawerRow({ item }: { item: CartItem }) {
  const { setQuantity, remove, close } = useCart();
  const image = item.product.images[0];
  const atStockLimit = item.quantity >= item.variant.stock;
  const lineTotal = item.variant.price.amount * item.quantity;

  return (
    <li className="flex gap-3 border-b border-cream-200 py-5">
      {image && (
        <Link
          href={`/products/${item.product.slug}`}
          onClick={close}
          className="relative block h-20 w-16 shrink-0 overflow-hidden bg-cream-200"
        >
          <Image src={image.url} alt={image.altText} fill sizes="64px" className="object-cover" />
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
            {item.variant.title !== 'Default' && (
              <p className="mt-1 text-xs text-ink-60">{item.variant.title}</p>
            )}
          </div>
          <p className="text-sm">{formatToman(lineTotal)}</p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-cream-200">
            <button
              type="button"
              onClick={() => setQuantity(item.id, item.quantity - 1)}
              aria-label="کاهش تعداد"
              className="h-7 w-7 text-sm text-ink-60 hover:text-ink"
            >
              −
            </button>
            <span className="w-6 text-center text-xs">{toPersianDigits(item.quantity)}</span>
            <button
              type="button"
              onClick={() => setQuantity(item.id, item.quantity + 1)}
              disabled={atStockLimit}
              aria-label="افزایش تعداد"
              className="h-7 w-7 text-sm text-ink-60 hover:text-ink disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => remove(item.id)}
            className="text-xs text-ink-60 underline hover:text-clay"
          >
            حذف
          </button>
        </div>
        {atStockLimit && <p className="mt-2 text-[11px] text-ink-60">حداکثر موجودی این گزینه.</p>}
      </div>
    </li>
  );
}
