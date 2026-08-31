// UNIT VERIFIED — pure arithmetic, no DB.
// The transactional row lock and audit-row insert around this call in
// inventory.ts's adjustStock are DB INTEGRATION UNVERIFIED here.
import { describe, expect, it } from 'vitest';
import { computeResultingStock, NegativeStockError } from './inventoryValidation';

describe('computeResultingStock', () => {
  it('adds a positive delta', () => {
    expect(computeResultingStock(10, 5)).toBe(15);
  });

  it('subtracts a negative delta', () => {
    expect(computeResultingStock(10, -3)).toBe(7);
  });

  it('allows landing exactly on zero', () => {
    expect(computeResultingStock(5, -5)).toBe(0);
  });

  it('throws NegativeStockError when the result would go below zero', () => {
    expect(() => computeResultingStock(5, -6)).toThrow(NegativeStockError);
  });
});
