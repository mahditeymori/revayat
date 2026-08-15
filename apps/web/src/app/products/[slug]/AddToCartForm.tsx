'use client';

import { useActionState, useEffect } from 'react';
import { addToCartAction, type CartActionState } from '@/app/cart/actions';
import type { Product } from '@/lib/catalog';

const INITIAL: CartActionState = { error: null, ok: false };

export function AddToCartForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(addToCartAction, INITIAL);

  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event('cart:updated'));
  }, [state]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="productId" value={product.id} />

      <fieldset>
        <legend className="mb-3 text-xs text-ink-60">سایز</legend>
        <div className="flex flex-wrap gap-2">
          {product.sizes.map((size, i) => (
            <label key={size} className="cursor-pointer">
              <input type="radio" name="size" value={size} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block border border-cream-200 px-4 py-2 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream hover:border-ink">
                {size}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {product.colors.length > 1 && (
        <fieldset>
          <legend className="mb-3 text-xs text-ink-60">رنگ</legend>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((color, i) => (
              <label key={color} className="cursor-pointer">
                <input type="radio" name="color" value={color} defaultChecked={i === 0} className="peer sr-only" />
                <span className="block border border-cream-200 px-4 py-2 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream hover:border-ink">
                  {color}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {product.colors.length === 1 && <input type="hidden" name="color" value={product.colors[0]} />}

      <button
        type="submit"
        disabled={!product.inStock || pending}
        className="w-full bg-ink py-4 text-sm text-cream transition-colors hover:bg-sand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!product.inStock ? 'ناموجود' : pending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
      </button>

      {state.error && (
        <p role="alert" className="text-xs text-clay">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-xs text-ink">
          به سبد اضافه شد. <a href="/cart" className="underline">دیدن سبد خرید</a>
        </p>
      )}
    </form>
  );
}
