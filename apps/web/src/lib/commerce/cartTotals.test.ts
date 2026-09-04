import { describe, expect, it } from 'vitest';
import { emptyCart, deriveCartTotals, clampQuantityInput } from './cartTotals';
import type { Cart, CartItem, Product, ProductVariant } from './types';

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'variant-1',
    sku: 'SKU-1',
    title: 'Default',
    availableForSale: true,
    stock: 10,
    selectedOptions: [],
    price: { amount: 100_000, currency: 'IRR' },
    compareAtPrice: null,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    slug: 'test-product',
    name: 'Test Product',
    subtitle: '',
    description: '',
    images: [],
    options: [],
    variants: [],
    price: { amount: 100_000, currency: 'IRR' },
    salePrice: null,
    categorySlug: null,
    featured: false,
    material: null,
    fabricType: null,
    weight: null,
    additionalNotes: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    variantId: 'variant-1',
    quantity: 1,
    product: makeProduct(),
    variant: makeVariant(),
    ...overrides,
  };
}

describe('emptyCart', () => {
  it('has zero items and zero subtotal', () => {
    const cart = emptyCart();
    expect(cart.items).toEqual([]);
    expect(cart.itemCount).toBe(0);
    expect(cart.subtotal).toEqual({ amount: 0, currency: 'IRR' });
  });
});

describe('deriveCartTotals', () => {
  it('sums quantity across items for itemCount', () => {
    const cart: Cart = {
      ...emptyCart(),
      items: [makeItem({ id: 'a', quantity: 2 }), makeItem({ id: 'b', quantity: 3 })],
    };
    expect(deriveCartTotals(cart).itemCount).toBe(5);
  });

  it('computes subtotal from variant price times quantity, never product.price', () => {
    const cart: Cart = {
      ...emptyCart(),
      items: [
        makeItem({
          id: 'a',
          quantity: 2,
          variant: makeVariant({ price: { amount: 250_000, currency: 'IRR' } }),
          product: makeProduct({ price: { amount: 999_999, currency: 'IRR' } }),
        }),
      ],
    };
    expect(deriveCartTotals(cart).subtotal.amount).toBe(500_000);
  });

  it('returns zero totals for an empty item list', () => {
    const result = deriveCartTotals({ ...emptyCart(), items: [] });
    expect(result.itemCount).toBe(0);
    expect(result.subtotal.amount).toBe(0);
  });
});

describe('clampQuantityInput', () => {
  it('floors decimals down to an integer', () => {
    expect(clampQuantityInput(3.9)).toBe(3);
  });

  it('clamps negative input to zero', () => {
    expect(clampQuantityInput(-5)).toBe(0);
  });

  it('treats zero as a valid (removal) quantity', () => {
    expect(clampQuantityInput(0)).toBe(0);
  });

  it('rejects non-finite input as zero', () => {
    expect(clampQuantityInput(Number.NaN)).toBe(0);
    expect(clampQuantityInput(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
