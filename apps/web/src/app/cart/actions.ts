'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addToCart, updateCartItem, getCart, clearCart } from '@/lib/cart';
import { getCatalog, createOrder, effectivePrice, type OrderItem } from '@/lib/catalog';
import { cookies } from 'next/headers';
import { record, CONSENT_COOKIE } from '@/lib/analytics';
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

  // Recorded server-side: a client beacon would miss orders whenever the
  // success redirect is interrupted, and could be forged from the browser.
  //
  // `consented` is what keeps the funnel honest. add_to_cart only exists for
  // visitors who accepted, so counting every purchase against it would let
  // cart→order exceed 100%. The flag never identifies the buyer — it is one bit
  // saying which population this row belongs to.
  const consent = (await cookies()).get(CONSENT_COOKIE)?.value;
  await record({
    t: new Date().toISOString(),
    type: 'purchase',
    path: '/checkout',
    visitor: 'server',
    value: order.totalRial,
    consented: consent === 'yes',
  }).catch(() => {}); // analytics must never block a completed order

  await clearCart();
  revalidatePath('/cart');
  redirect(`/checkout/success?order=${order.id}`);
}
