'use server';

import { cookies } from 'next/headers';
import { addToCart, getCart, updateCartItem, removeFromCart } from '@/lib/commerce/cart';
import { emptyCart, clampQuantityInput } from '@/lib/commerce/cartTotals';
import type { Cart } from '@/lib/commerce/types';

export type CartActionState = { error: string | null; ok: boolean };

// The cartToken cookie is the ONLY thing ever stored client-side for cart
// state — see db/schema.ts's `carts` table comment. Signed by Next's cookie
// store (httpOnly), never readable or writable from client JS.
const CART_COOKIE = 'cartToken';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

async function setCartCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

// Shared by CartProvider (drawer + badge) and /cart's own initial load. A
// missing cookie is a legitimate empty cart, not a failure — it is NOT
// wrapped in the safe() build-time fallback pattern: a real DB error here is
// logged and re-thrown so the caller can show an explicit "cart unavailable"
// state instead of silently rendering an empty cart as if nothing were wrong.
export async function getCartAction(): Promise<Cart> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return emptyCart();
  try {
    const cart = await getCart(token);
    return cart ?? emptyCart();
  } catch (err) {
    console.error('[cart] getCart failed', err instanceof Error ? err.message : err);
    throw new Error('سبد خرید در دسترس نیست. صفحه را دوباره بارگذاری کنید.');
  }
}

export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const variantId = String(formData.get('variantId') ?? '');
  if (!variantId) return { error: 'لطفاً یک گزینه را انتخاب کنید.', ok: false };

  try {
    const token = (await cookies()).get(CART_COOKIE)?.value;
    const cart = await addToCart(token, variantId, 1);
    if (cart.token !== token) await setCartCookie(cart.token);

    const added = cart.items.some((item) => item.variantId === variantId);
    if (!added) return { error: 'موجودی این گزینه به پایان رسیده است.', ok: false };
    return { error: null, ok: true };
  } catch (err) {
    console.error('[cart] addToCart failed', err instanceof Error ? err.message : err);
    return { error: 'مشکلی در افزودن به سبد خرید پیش آمد. دوباره تلاش کنید.', ok: false };
  }
}

// Plain, non-FormData actions so the drawer and /cart page call the exact
// same mutation — no separate "drawer-actions" implementation. Both throw
// explicitly (after logging the real cause) on failure rather than
// swallowing the error, per the rule that cart mutations must never use a
// silent fallback: the caller is responsible for reverting its optimistic
// UI and surfacing the message.
export async function updateCartItemAction(itemId: string, quantity: number): Promise<Cart> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) throw new Error('سبد خرید یافت نشد. صفحه را دوباره بارگذاری کنید.');
  try {
    return await updateCartItem(token, itemId, clampQuantityInput(quantity));
  } catch (err) {
    console.error('[cart] updateCartItem failed', err instanceof Error ? err.message : err);
    throw new Error('به‌روزرسانی سبد خرید ناموفق بود.');
  }
}

export async function removeFromCartAction(itemId: string): Promise<Cart> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) throw new Error('سبد خرید یافت نشد. صفحه را دوباره بارگذاری کنید.');
  try {
    return await removeFromCart(token, itemId);
  } catch (err) {
    console.error('[cart] removeFromCart failed', err instanceof Error ? err.message : err);
    throw new Error('حذف از سبد خرید ناموفق بود.');
  }
}
