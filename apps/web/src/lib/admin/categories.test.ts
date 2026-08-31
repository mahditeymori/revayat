// UNIT VERIFIED — pure schema logic, no DB.
import { describe, expect, it } from 'vitest';
import { categoryInput } from './categoryValidation';

describe('categoryInput', () => {
  it('rejects a slug containing spaces or uppercase letters', () => {
    expect(() => categoryInput.parse({ slug: 'Not Ok', name: 'x' })).toThrow();
  });

  it('accepts a valid slug and defaults sortOrder to 0', () => {
    const result = categoryInput.parse({ slug: 'valid-slug', name: 'x' });
    expect(result.sortOrder).toBe(0);
  });
});
