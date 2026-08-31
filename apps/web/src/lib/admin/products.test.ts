// UNIT VERIFIED — pure schema/validation logic, no DB.
// Duplicate-slug rejection (assertSlugFree) is DB-bound and DB INTEGRATION UNVERIFIED here.
import { describe, expect, it } from 'vitest';
import { assertNoDuplicateVariants, productInput, variantInput } from './productValidation';

describe('assertNoDuplicateVariants', () => {
  it('accepts variants with distinct size/color combos', () => {
    expect(() =>
      assertNoDuplicateVariants([
        { size: 'M', color: 'black', sku: null, priceRial: null, compareAtPriceRial: null, stock: 0, active: true },
        { size: 'L', color: 'black', sku: null, priceRial: null, compareAtPriceRial: null, stock: 0, active: true },
      ]),
    ).not.toThrow();
  });

  it('rejects a repeated size/color combo', () => {
    expect(() =>
      assertNoDuplicateVariants([
        { size: 'M', color: 'black', sku: null, priceRial: null, compareAtPriceRial: null, stock: 0, active: true },
        { size: 'M', color: 'black', sku: null, priceRial: null, compareAtPriceRial: null, stock: 0, active: true },
      ]),
    ).toThrow();
  });
});

describe('variantInput', () => {
  it('rejects negative stock', () => {
    expect(() => variantInput.parse({ stock: -1 })).toThrow();
  });
});

describe('productInput', () => {
  it('rejects a slug with uppercase or non-Latin characters', () => {
    const base = { name: 'محصول', priceRial: 1000, variants: [{ stock: 1 }] };
    expect(() => productInput.parse({ ...base, slug: 'Bad Slug' })).toThrow();
    expect(() => productInput.parse({ ...base, slug: 'valid-slug' })).not.toThrow();
  });

  it('requires at least one variant', () => {
    expect(() =>
      productInput.parse({ slug: 'a', name: 'a', priceRial: 1000, variants: [] }),
    ).toThrow();
  });
});
