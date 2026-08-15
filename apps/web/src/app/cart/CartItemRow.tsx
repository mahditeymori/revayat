'use client';

import { useActionState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { updateCartItemAction, removeCartItemAction, type CartActionState } from './actions';
import { formatToman } from '@/lib/format';
import type { CartItem } from '@/lib/cart';

const INITIAL: CartActionState = { error: null };

export function CartItemRow({ item }: { item: CartItem }) {
  const [updateState, updateAction, updating] = useActionState(updateCartItemAction, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeCartItemAction, INITIAL);
  const busy = updating || removing;

  useEffect(() => {
    if (!updateState.error && !removeState.error) window.dispatchEvent(new Event('cart:updated'));
  }, [updateState, removeState]);
  const image = item.product.images[0];

  return (
    <li className="flex gap-4 border-b border-cream-200 py-6">
      {image && (
        <Link href={`/products/${item.product.slug}`} className="relative block h-32 w-24 shrink-0 overflow-hidden bg-cream-200">
          <Image src={image} alt={item.product.name} fill sizes="96px" className="object-cover" />
        </Link>
      )}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/products/${item.product.slug}`} className="text-sm font-medium hover:text-sand-dark">
              {item.product.name}
            </Link>
            <p className="mt-1 text-xs text-ink-60">
              سایز: {item.size}
              {item.color && ` / رنگ: ${item.color}`}
            </p>
          </div>
          <p className="text-sm">{formatToman(item.lineTotalRial)}</p>
        </div>

        <div className="mt-auto flex items-center gap-4 pt-4">
          <form action={updateAction} className="flex items-center gap-2">
            <input type="hidden" name="key" value={item.key} />
            <label className="sr-only" htmlFor={`qty-${item.key}`}>تعداد</label>
            <input
              id={`qty-${item.key}`}
              name="quantity"
              type="number"
              min={1}
              max={99}
              defaultValue={item.quantity}
              disabled={busy}
              className="w-16 border border-cream-200 bg-transparent px-2 py-1 text-center text-sm"
            />
            <button type="submit" disabled={busy} className="text-xs text-ink-60 underline hover:text-ink disabled:opacity-50">
              به‌روزرسانی
            </button>
          </form>
          <form action={removeAction}>
            <input type="hidden" name="key" value={item.key} />
            <button type="submit" disabled={busy} className="text-xs text-ink-60 underline hover:text-clay disabled:opacity-50">
              حذف
            </button>
          </form>
        </div>
        {(updateState.error || removeState.error) && (
          <p role="alert" className="mt-2 text-xs text-clay">
            {updateState.error || removeState.error}
          </p>
        )}
      </div>
    </li>
  );
}
