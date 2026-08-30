// Pure shipping-form validation, extracted out of app/checkout/actions.ts so
// it's testable without a request/DB context — mirrors cartTotals.ts's split
// between pure logic and the 'use server' action that calls it.

export const PHONE_RE = /^09\d{9}$/;
export const POSTCODE_RE = /^\d{10}$/;

export type ShippingFormInput = {
  name: string;
  phone: string;
  state: string;
  city: string;
  address: string;
  postcode: string;
};

export type ShippingValidationError = 'name' | 'phone' | 'address' | 'postcode';

export function validateShippingForm(input: ShippingFormInput): ShippingValidationError | null {
  if (input.name.trim().length < 3) return 'name';
  if (!PHONE_RE.test(input.phone.trim())) return 'phone';
  if (!input.state.trim() || !input.city.trim() || !input.address.trim()) return 'address';
  if (!POSTCODE_RE.test(input.postcode.trim())) return 'postcode';
  return null;
}
