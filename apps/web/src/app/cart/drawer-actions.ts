'use server';

// Plain-argument counterparts to actions.ts, callable directly from the cart
// drawer's client code (no FormData/useActionState — the drawer keeps its own
// client-side Cart in CartProvider and needs the fresh value back in one
// round trip). actions.ts stays untouched: /cart's rows still use the
// form-bound versions with revalidatePath for their own server-rendered list.
import { getCart, updateCartItem, type Cart } from '@/lib/cart';

export async function getCartAction(): Promise<Cart> {
  return getCart();
}

export async function setCartQtyAction(key: string, qty: number): Promise<Cart> {
  await updateCartItem(key, Math.max(0, Math.min(99, Math.trunc(qty))));
  return getCart();
}

export async function removeCartItemFromDrawerAction(key: string): Promise<Cart> {
  await updateCartItem(key, 0);
  return getCart();
}
