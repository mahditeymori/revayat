// UNIT VERIFIED — pure schema/formatting logic, no DB.
// Duplicate-code rejection (assertCodeFree) and usage-limit evaluation live in
// the DB-bound functions and are DB INTEGRATION UNVERIFIED here.
import { describe, expect, it } from 'vitest';
import { couponInput, maskPhone } from './couponValidation';

describe('maskPhone', () => {
  it('keeps the first 4 and last digit, masks the rest', () => {
    expect(maskPhone('09121234567')).toBe('0912******7');
  });

  it('leaves very short input alone rather than over-masking', () => {
    expect(maskPhone('0912')).toBe('0912');
  });
});

describe('couponInput', () => {
  it('accepts a minimal valid percentage coupon and defaults optional fields', () => {
    const result = couponInput.parse({ code: 'revayat20', type: 'percentage', value: 20 });
    expect(result.code).toBe('REVAYAT20');
    expect(result.maxUsesTotal).toBeNull();
    expect(result.maxUsesPerCustomer).toBe(1);
    expect(result.assignedPhone).toBeNull();
  });

  it('rejects a non-positive value', () => {
    expect(() => couponInput.parse({ code: 'X', type: 'fixed', value: 0 })).toThrow();
  });

  it('turns a blank assignedPhone into null (unrestricted coupon)', () => {
    const result = couponInput.parse({ code: 'X', type: 'fixed', value: 1000, assignedPhone: '' });
    expect(result.assignedPhone).toBeNull();
  });

  it('turns a blank expiresAt into null (no expiry) instead of Invalid Date', () => {
    const result = couponInput.parse({ code: 'X', type: 'fixed', value: 1000, expiresAt: '' });
    expect(result.expiresAt).toBeNull();
  });
});
