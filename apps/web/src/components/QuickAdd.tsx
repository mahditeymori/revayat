'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { addToCartAction, type CartActionState } from '@/app/cart/actions';
import { useCart } from '@/components/cart/CartProvider';
import type { Product, ProductVariant } from '@/lib/commerce/types';

const INITIAL: CartActionState = { error: null, ok: false };

// Duplicated from VariantSelector.tsx on purpose — small pure helper, not
// worth exporting/importing across an otherwise independent component.
function findVariant(variants: ProductVariant[], selected: Record<string, string>): ProductVariant | undefined {
  return variants.find(
    (v) =>
      v.selectedOptions.length === Object.keys(selected).length &&
      v.selectedOptions.every((opt) => selected[opt.name] === opt.value),
  );
}

// Minimal variant popover for ProductCard's "quick add" — reuses
// addToCartAction/findVariant exactly as VariantSelector does, no new
// server action or validation. Lives entirely inside ProductCard's DOM;
// does not add a prop to ProductCard's public signature.
export function QuickAdd({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addToCartAction, INITIAL);
  const { afterAdd } = useCart();

  const defaultVariant = useMemo(
    () => product.variants.find((v) => v.availableForSale) ?? product.variants[0],
    [product.variants],
  );
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of defaultVariant?.selectedOptions ?? []) initial[opt.name] = opt.value;
    return initial;
  });

  useEffect(() => {
    if (state.ok) afterAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const variant = product.options.length > 0 ? findVariant(product.variants, selected) : defaultVariant;
  const available = variant?.availableForSale ?? false;

  return (
    <div className="relative z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-11 w-full border border-ink bg-cream/95 py-2 text-xs text-ink opacity-100 transition-opacity hover:bg-ink hover:text-cream sm:min-h-0 sm:py-2 sm:opacity-0 sm:group-hover:opacity-100"
      >
        افزودن سریع
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`افزودن سریع ${product.name}`}
          className="absolute inset-x-0 bottom-full z-20 mb-2 border border-cream-200 bg-cream p-4 shadow-lg"
        >
          <form action={action} className="space-y-3">
            <input type="hidden" name="variantId" value={variant?.id ?? ''} />
            {product.options.map((option) => (
              <fieldset key={option.id}>
                <legend className="mb-1.5 text-[11px] text-ink-60">{option.name}</legend>
                <div className="flex flex-wrap gap-1.5">
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
                        <span className="block min-h-11 border border-cream-200 px-2.5 py-1 text-xs leading-[2.5] transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream hover:border-ink sm:min-h-0 sm:leading-normal">
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
              className="min-h-11 w-full bg-ink py-2.5 text-xs text-cream transition-colors hover:bg-sand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!variant || !available ? 'ناموجود' : pending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
            </button>
            {state.error && (
              <p role="alert" className="text-[11px] text-clay">
                {state.error}
              </p>
            )}
            {state.ok && (
              <p role="status" className="text-[11px] text-ink">
                به سبد اضافه شد.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
