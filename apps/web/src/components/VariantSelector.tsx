'use client';

import { useActionState, useMemo, useState } from 'react';
import { addToCartAction, type CartActionState } from '@/app/cart/actions';
import { formatToman } from '@/lib/format';
import type { Product, ProductVariant } from '@/lib/commerce/types';

const INITIAL: CartActionState = { error: null, ok: false };

function findVariant(
  variants: ProductVariant[],
  selected: Record<string, string>,
): ProductVariant | undefined {
  return variants.find(
    (v) =>
      v.selectedOptions.length === Object.keys(selected).length &&
      v.selectedOptions.every((opt) => selected[opt.name] === opt.value),
  );
}

export function VariantSelector({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(addToCartAction, INITIAL);

  const defaultVariant = useMemo(
    () => product.variants.find((v) => v.availableForSale) ?? product.variants[0],
    [product.variants],
  );

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of defaultVariant?.selectedOptions ?? []) initial[opt.name] = opt.value;
    return initial;
  });

  const variant = product.options.length > 0 ? findVariant(product.variants, selected) : defaultVariant;
  const price = variant?.price.amount ?? product.price.amount;
  const compareAtPrice = variant?.compareAtPrice?.amount;
  const available = variant?.availableForSale ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-lg">{formatToman(price)}</p>
        {compareAtPrice != null && compareAtPrice > price && (
          <p className="text-sm text-ink-60 line-through">{formatToman(compareAtPrice)}</p>
        )}
      </div>

      <form action={action} className="space-y-6">
        <input type="hidden" name="variantId" value={variant?.id ?? ''} />

        {product.options.map((option) => (
          <fieldset key={option.id}>
            <legend className="mb-3 text-xs text-ink-60">{option.name}</legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const checked = selected[option.name] === value;
                return (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`option-${option.id}`}
                      value={value}
                      checked={checked}
                      onChange={() => setSelected((prev) => ({ ...prev, [option.name]: value }))}
                      className="peer sr-only"
                    />
                    <span className="block border border-cream-200 px-4 py-2 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream hover:border-ink">
                      {value}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          disabled={!variant || !available || pending}
          className="w-full bg-ink py-4 text-sm text-cream transition-colors hover:bg-sand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!variant || !available ? 'ناموجود' : pending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
        </button>

        {state.error && (
          <p role="alert" className="text-xs text-clay">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-xs text-ink">
            به سبد اضافه شد.
          </p>
        )}
      </form>
    </div>
  );
}
