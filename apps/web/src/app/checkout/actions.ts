'use server';

// Single submit path for the checkout form: validates the shipping fields,
// creates the order (which itself re-resolves prices, reserves stock, and
// validates any coupon inside one transaction — see lib/commerce/orders.ts),
// then starts a Zibal payment session and redirects the browser to the
// gateway. Every failure redirects back to /checkout (or /payment/failed once
// an order actually exists) with an `error` query param instead of throwing —
// there is nothing here a customer can retry by resubmitting a raw error page.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCart } from '@/lib/commerce/cart';
import { createOrder, CouponRejectedError, InsufficientStockError } from '@/lib/commerce/orders';
import { validateShippingForm } from '@/lib/commerce/checkoutValidation';
import { startPayment } from '@/lib/zibal/payment-flow';
import { isConfigured } from '@/lib/zibal/client';
import { checkRateLimit } from '@/lib/security/rate-limit';

const CART_COOKIE = 'cartToken';
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;

function backToCheckout(error: string): never {
  redirect(`/checkout?error=${error}`);
}

export async function submitCheckoutAction(formData: FormData): Promise<void> {
  const h = await headers();
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown';
  // Abuse-proofing for order creation (which itself validates the coupon and
  // reserves stock) — separate from startPayment's own per-order limit below,
  // since a single IP hammering "new checkout" spam is a different attack
  // shape than one order's payment being retried.
  const submitLimit = await checkRateLimit(`checkout-submit:ip:${ip}`, { limit: 10, windowMs: SUBMIT_WINDOW_MS });
  if (!submitLimit.allowed) backToCheckout('rate-limited');

  const cartToken = (await cookies()).get(CART_COOKIE)?.value;
  const cart = await getCart(cartToken);
  if (!cart || cart.items.length === 0) redirect('/cart');

  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const postcode = String(formData.get('postcode') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const couponCode = String(formData.get('couponCode') ?? '').trim();

  const validationError = validateShippingForm({ name, phone, state, city, address, postcode });
  if (validationError) backToCheckout(validationError);
  if (!isConfigured()) backToCheckout('gateway');

  let orderId: number;
  try {
    const order = await createOrder({
      cartToken: cartToken!,
      shipping: { name, phone, address: `${state}، ${city}، ${address}`, postalCode: postcode },
      couponCode: couponCode || undefined,
    });
    orderId = order.id;
  } catch (err) {
    if (err instanceof InsufficientStockError) backToCheckout('stock');
    if (err instanceof CouponRejectedError) backToCheckout(`coupon-${err.reason}`);
    console.error('[checkout] createOrder failed', err instanceof Error ? err.message : err);
    backToCheckout('unknown');
  }

  const payment = await startPayment(orderId, phone);
  if (!payment.ok) {
    redirect(`/payment/failed?order=${orderId}&reason=${encodeURIComponent(payment.message)}`);
  }
  redirect(payment.startUrl);
}
