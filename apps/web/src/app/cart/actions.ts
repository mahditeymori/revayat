'use server';

import { cookies } from 'next/headers';
import { addToCart } from '@/lib/commerce/cart';

export type CartActionState = { error: string | null; ok: boolean };

// The cartToken cookie is the ONLY thing ever stored client-side for cart
// state — see db/schema.ts's `carts` table comment. Signed by Next's cookie
// store (httpOnly), never readable or writable from client JS.
const CART_COOKIE = 'cartToken';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const variantId = String(formData.get('variantId') ?? '');
  if (!variantId) return { error: 'لطفاً یک گزینه را انتخاب کنید.', ok: false };

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CART_COOKIE)?.value;

  const cart = await addToCart(existingToken, variantId, 1);

  if (cart.token !== existingToken) {
    cookieStore.set(CART_COOKIE, cart.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }

  const added = cart.items.some((item) => item.variantId === variantId);
  if (!added) return { error: 'موجودی این گزینه به پایان رسیده است.', ok: false };

  return { error: null, ok: true };
}
