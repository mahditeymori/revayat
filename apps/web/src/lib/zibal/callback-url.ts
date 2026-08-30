// The public callback URL Zibal sends the browser back to.
//
// Split out of client.ts because it is the one piece that needs a live request
// scope (next/headers). Keeping it separate lets the gateway client and the
// payment flow be imported - and tested - outside a request.
import 'server-only';
import { headers } from 'next/headers';
import { site } from '@/lib/site';

/**
 * Absolute https origin for callbackUrl. Zibal rejects relative URLs (result
 * 106) and the browser is bounced back here from the bank, so this must be the
 * public origin - taken from the proxy headers so local and staging hosts work,
 * with the canonical site URL as the fallback.
 */
export async function callbackUrl(): Promise<string> {
  let origin: string = site.url;
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
      const proto = h.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
      origin = `${proto}://${host}`;
    }
  } catch {
    // outside a request scope - fall back to the canonical site url
  }
  return `${origin.replace(/\/+$/, '')}/payment/callback`;
}
