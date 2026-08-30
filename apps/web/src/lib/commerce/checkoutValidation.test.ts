import { describe, expect, it } from 'vitest';
import { validateShippingForm, type ShippingFormInput } from './checkoutValidation';

function makeInput(overrides: Partial<ShippingFormInput> = {}): ShippingFormInput {
  return {
    name: 'علی رضایی',
    phone: '09123456789',
    state: 'تهران',
    city: 'تهران',
    address: 'خیابان ولیعصر، پلاک ۱',
    postcode: '1234567890',
    ...overrides,
  };
}

describe('validateShippingForm', () => {
  it('accepts a fully valid form', () => {
    expect(validateShippingForm(makeInput())).toBeNull();
  });

  it('rejects a name shorter than 3 characters', () => {
    expect(validateShippingForm(makeInput({ name: 'ع' }))).toBe('name');
  });

  it('rejects a name that is only whitespace', () => {
    expect(validateShippingForm(makeInput({ name: '   ' }))).toBe('name');
  });

  it('rejects a phone number missing the 09 prefix', () => {
    expect(validateShippingForm(makeInput({ phone: '9123456789' }))).toBe('phone');
  });

  it('rejects a phone number with the wrong length', () => {
    expect(validateShippingForm(makeInput({ phone: '091234567' }))).toBe('phone');
  });

  it('rejects a missing state', () => {
    expect(validateShippingForm(makeInput({ state: '' }))).toBe('address');
  });

  it('rejects a missing city', () => {
    expect(validateShippingForm(makeInput({ city: '' }))).toBe('address');
  });

  it('rejects a missing street address', () => {
    expect(validateShippingForm(makeInput({ address: '' }))).toBe('address');
  });

  it('rejects a postcode that is not exactly 10 digits', () => {
    expect(validateShippingForm(makeInput({ postcode: '12345' }))).toBe('postcode');
  });

  it('rejects a postcode containing non-digit characters', () => {
    expect(validateShippingForm(makeInput({ postcode: '12345abcde' }))).toBe('postcode');
  });

  it('checks fields in a fixed priority order (name before phone before address before postcode)', () => {
    expect(validateShippingForm(makeInput({ name: '', phone: 'bad', postcode: 'bad' }))).toBe('name');
  });
});
