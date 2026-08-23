// Zibal callback: GET /payment/callback?trackId=…&success=1&status=2&orderId=…
//
// This URL is public and the query string is entirely attacker-controllable, so
// nothing in it is trusted beyond `trackId` - and even that is only used to look
// up a payment row we created ourselves. `success` and `status` are read for
// logging and for skipping a pointless verify on an obvious cancellation; they
// never decide whether an order is paid. That decision belongs to /v1/verify,
// via settlePayment().
//
// A route handler rather than a page: it must never be prerendered or cached,
// and it needs to write cookies (clearing the cart) while redirecting.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearCart } from '@/lib/cart';
import { settlePayment, type SettleResult } from '@/lib/payment-flow';
import { isTrackId } from '@/lib/zibal-codes';
import { record, CONSENT_COOKIE } from '@/lib/analytics';
import { getOrder } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const params = new URL(req.url).searchParams;
  const trackId = (params.get('trackId') ?? '').trim();
  const success = params.get('success');
  const status = params.get('status');

  console.info(`[payment] callback trackId=${trackId || '-'} success=${success ?? '-'} status=${status ?? '-'}`);

  // No trackId means this was not a real callback. There is nothing to look up.
  if (!isTrackId(trackId)) {
    console.error('[payment] callback without a usable trackId');
    return redirectTo(req, '/payment/failed?reason=' + encodeURIComponent('اطلاعات بازگشت از درگاه ناقص بود.'));
  }

  const result = await settlePayment(trackId);

  if (result.outcome === 'paid' || result.outcome === 'already-paid') {
    // Only a genuinely new payment counts as a purchase and empties the cart.
    // 'already-paid' is a repeated callback: the order was completed on the
    // first pass, so re-recording it would double-count revenue.
    if (result.outcome === 'paid') {
      await onPaid(result);
    }
    const url = `/payment/result?trackId=${encodeURIComponent(trackId)}`;
    return redirectTo(req, url);
  }

  const reason = encodeURIComponent(result.message);
  const order = result.orderId ? `&order=${result.orderId}` : '';
  return redirectTo(req, `/payment/failed?trackId=${encodeURIComponent(trackId)}${order}&reason=${reason}`);
}

/** Zibal has been observed to POST some callbacks; treat both the same. */
export const POST = GET;

/** Everything that happens exactly once, when an order first becomes paid. */
async function onPaid(result: SettleResult): Promise<void> {
  await clearCart().catch((err) => {
    // A cart that fails to clear is a nuisance, not a lost order.
    console.error('[payment] could not clear the cart after payment:', err);
  });

  const order = result.orderId ? await getOrder(result.orderId) : null;
  if (!order) return;

  // Recorded here rather than at checkout, so the funnel counts money received
  // rather than forms submitted. See the consent note in analytics.ts - the flag
  // says which population the row belongs to, never who the buyer was.
  const consent = (await cookies()).get(CONSENT_COOKIE)?.value;
  await record({
    t: new Date().toISOString(),
    type: 'purchase',
    path: '/payment/callback',
    visitor: 'server',
    value: order.totalRial,
    consented: consent === 'yes',
  }).catch(() => {}); // analytics must never block a completed order
}

/** 303 so the browser switches to GET and a refresh cannot replay the callback. */
function redirectTo(req: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url), 303);
}
