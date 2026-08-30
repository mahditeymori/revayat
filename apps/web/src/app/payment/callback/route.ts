// Zibal callback: GET /payment/callback?trackId=…&success=1&status=2
//
// This URL is public and the query string is entirely attacker-controllable,
// so nothing in it is trusted beyond `trackId` — and even that is only used
// to look up a payment row we created ourselves. `success`/`status` are
// logged only; the paid/not-paid decision belongs exclusively to
// settlePayment()'s own /v1/verify call.
//
// A route handler rather than a page: it must never be prerendered or
// cached, and it needs to clear the cart cookie's underlying rows while
// redirecting.
import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/commerce/orders';
import { clearCart } from '@/lib/commerce/cart';
import { settlePayment, type PaymentOutcome } from '@/lib/zibal/payment-flow';
import { isTrackId } from '@/lib/zibal/client';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const params = new URL(req.url).searchParams;
  const trackId = (params.get('trackId') ?? '').trim();
  const success = params.get('success');
  const status = params.get('status');

  console.info(`[payment] callback trackId=${trackId || '-'} success=${success ?? '-'} status=${status ?? '-'}`);

  if (!isTrackId(trackId)) {
    console.error('[payment] callback without a usable trackId');
    return redirectTo(req, `/payment/failed?reason=${encodeURIComponent('اطلاعات بازگشت از درگاه ناقص بود.')}`);
  }

  const outcome = await settlePayment(trackId);
  return redirectTo(req, await resolveRedirect(outcome));
}

/** Zibal has been observed to POST some callbacks; treat both the same. */
export const POST = GET;

async function resolveRedirect(outcome: PaymentOutcome): Promise<string> {
  switch (outcome.kind) {
    case 'paid': {
      // Only a genuinely new payment clears the cart — 'already-paid' is a
      // repeated callback for an order already settled on the first pass.
      if (!outcome.alreadyVerified) {
        const order = await getOrder(outcome.orderId);
        if (order) {
          await clearCart(order.cartToken).catch((err) => {
            // A cart that fails to clear is a nuisance, not a lost order.
            console.error('[payment] could not clear the cart after payment:', err);
          });
        }
      }
      return `/payment/result?order=${outcome.orderId}`;
    }
    case 'amount-mismatch':
      return failedUrl(outcome.orderId, 'مبلغ پرداخت‌شده با مبلغ سفارش مطابقت نداشت.');
    case 'canceled':
      return failedUrl(outcome.orderId, 'پرداخت توسط شما لغو شد.');
    case 'failed':
      return failedUrl(outcome.orderId, 'پرداخت ناموفق بود.');
    case 'awaiting':
      return failedUrl(outcome.orderId, 'نتیجه پرداخت هنوز از درگاه دریافت نشده است. لطفاً دوباره تلاش کنید.');
    case 'query-failed':
      return failedUrl(outcome.orderId, 'بررسی وضعیت پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
    case 'not-found':
      return failedUrl(null, 'اطلاعات بازگشت از درگاه نامعتبر بود.');
  }
}

function failedUrl(orderId: number | null, message: string): string {
  const order = orderId != null ? `order=${orderId}&` : '';
  return `/payment/failed?${order}reason=${encodeURIComponent(message)}`;
}

/**
 * 303 so the browser switches to GET and a refresh cannot replay the callback.
 *
 * Built from the public origin, not `req.url` — behind the reverse proxy the
 * app is bound to 0.0.0.0:3000, so `req.url` resolves to an address the
 * browser cannot reach. Same reasoning as callbackUrl() in
 * lib/zibal/callback-url.ts, mirrored here because a route handler already
 * has the headers on `req` and doesn't need next/headers.
 */
function redirectTo(req: Request, path: string): NextResponse {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let origin = site.url;
  if (host) {
    const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    const proto = req.headers.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
    origin = `${proto}://${host}`;
  }
  return NextResponse.redirect(new URL(path, origin), 303);
}
