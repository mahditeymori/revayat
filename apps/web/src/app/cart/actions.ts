'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addToCart, updateCartItem, getCart } from '@/lib/cart';
import { getCatalog, createOrder, effectivePrice, type OrderItem } from '@/lib/catalog';
import { startPayment } from '@/lib/payment-flow';
import { callbackUrl } from '@/lib/zibal-callback-url';
import { normalizeDigits } from '@/lib/format';

export type CartActionState = { error: string | null; ok?: boolean };

export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const id = Number(formData.get('productId'));
  const size = String(formData.get('size') ?? '');
  const color = String(formData.get('color') ?? '');

  const { products } = await getCatalog();
  const product = products.find((p) => p.id === id);
  if (!product || !product.inStock) return { error: 'این محصول موجود نیست.', ok: false };
  if (!product.sizes.includes(size)) return { error: 'لطفاً سایز را انتخاب کنید.', ok: false };
  if (!product.colors.includes(color)) return { error: 'لطفاً رنگ را انتخاب کنید.', ok: false };

  await addToCart(id, size, color, 1);
  revalidatePath('/cart');
  return { error: null, ok: true };
}

export async function updateCartItemAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const key = String(formData.get('key') ?? '');
  const qty = Math.trunc(Number(normalizeDigits(String(formData.get('quantity') ?? '1'))));
  if (!key || !Number.isFinite(qty)) return { error: 'درخواست نامعتبر است.' };
  await updateCartItem(key, Math.min(99, qty));
  revalidatePath('/cart');
  return { error: null };
}

export async function removeCartItemAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const key = String(formData.get('key') ?? '');
  if (!key) return { error: 'درخواست نامعتبر است.' };
  await updateCartItem(key, 0);
  revalidatePath('/cart');
  return { error: null };
}

export async function submitCheckoutAction(formData: FormData): Promise<void> {
  const field = (name: string) => normalizeDigits(String(formData.get(name) ?? '')).trim();
  const customer = {
    name: field('name'),
    phone: field('phone'),
    email: field('email'),
    state: field('state'),
    city: field('city'),
    address: field('address'),
    postcode: field('postcode'),
  };

  if (!customer.name || customer.name.length > 100) redirect('/checkout?error=name');
  if (!/^09\d{9}$/.test(customer.phone)) redirect('/checkout?error=phone');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) redirect('/checkout?error=email');
  if (!customer.state || !customer.city || !customer.address) redirect('/checkout?error=address');
  if (customer.postcode && !/^\d{10}$/.test(customer.postcode)) redirect('/checkout?error=postcode');

  const cart = await getCart();
  if (cart.items.length === 0) redirect('/cart');

  const items: OrderItem[] = cart.items.map((i) => ({
    productId: i.product.id,
    name: i.product.name,
    image: i.product.images[0] ?? '',
    size: i.size,
    color: i.color,
    quantity: i.quantity,
    priceRial: effectivePrice(i.product),
  }));

  const order = await createOrder(customer, items);

  // Hand off to Zibal before the cart is cleared and before anything is counted
  // as a purchase: nothing about this order is final until the money arrives.
  // If the gateway is down the order still exists, so the customer can retry
  // from the failure page instead of re-entering the whole form.
  const payment = await startPayment(order, await callbackUrl());
  if (!payment.ok) {
    redirect(`/payment/failed?order=${order.id}&reason=${encodeURIComponent(payment.message)}`);
  }

  // The cart is deliberately NOT cleared here. The customer is about to leave
  // for the bank and may cancel or fail; an emptied cart would strand them with
  // nothing to go back to. /payment/callback clears it once the money lands.
  redirect(payment.redirectUrl);
}
