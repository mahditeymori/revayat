'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { formatToman, toPersianDigits } from '@/lib/format';
import type { CartItem } from '@/lib/commerce/types';

export function CartItemRow({ item }: { item: CartItem }) {
  const { setQuantity, remove } = useCart();
  const image = item.product.images[0];
  const atStockLimit = item.quantity >= item.variant.stock;
  const lineTotal = item.variant.price.amount * item.quantity;

  return (
    <li className="flex gap-4 border-b border-cream-200 py-6">
      {image && (
        <Link
          href={`/products/${item.product.slug}`}
          className="relative block h-32 w-24 shrink-0 overflow-hidden bg-cream-200"
        >
          <Image src={image.url} alt={image.altText} fill sizes="96px" className="object-cover" />
        </Link>
      )}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/products/${item.product.slug}`} className="text-sm font-medium hover:text-sand-dark">
              {item.product.name}
            </Link>
            {item.variant.title !== 'Default' && (
              <p className="mt-1 text-xs text-ink-60">{item.variant.title}</p>
            )}
          </div>
          <p className="text-sm">{formatToman(lineTotal)}</p>
        </div>

        <div className="mt-auto flex items-center gap-4 pt-4">
          <div className="flex items-center border border-cream-200">
            <button
              type="button"
              onClick={() => setQuantity(item.id, item.quantity - 1)}
              aria-label="کاهش تعداد"
              className="h-8 w-8 text-sm text-ink-60 hover:text-ink"
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{toPersianDigits(item.quantity)}</span>
            <button
              type="button"
              onClick={() => setQuantity(item.id, item.quantity + 1)}
              disabled={atStockLimit}
              aria-label="افزایش تعداد"
              className="h-8 w-8 text-sm text-ink-60 hover:text-ink disabled:opacity-40"
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
