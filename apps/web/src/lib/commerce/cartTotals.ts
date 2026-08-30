import type { Cart, CartItem } from './types';

/** The shape of a cart with no row in the database yet — no cookie, no cart_items. */
export function emptyCart(): Cart {
  return { id: '', token: '', items: [], itemCount: 0, subtotal: { amount: 0, currency: 'IRR' } };
}

/**
 * Recomputes itemCount/subtotal from an item list. Used client-side to keep
 * an optimistic cart update internally consistent (e.g. a stepper click)
 * before the server's authoritative response replaces it — never used to
 * compute a price that gets persisted or charged.
 */
export function deriveCartTotals(cart: Cart): Cart {
  const items: CartItem[] = cart.items;
  return {
    ...cart,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: {
      amount: items.reduce((sum, item) => sum + item.variant.price.amount * item.quantity, 0),
      currency: 'IRR',
    },
  };
}

/** Clamps a user-entered quantity to a sane integer range before it ever reaches a server action. */
export function clampQuantityInput(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.trunc(raw));
}
