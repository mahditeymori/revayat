'use client';

// Fires one pageview per route change. Kept in the root layout so it also
// covers client-side navigations, which a server-side middleware hook misses.
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Duplicated from lib/analytics.ts rather than imported: that module opens `fs`
// at the top level, and importing it here would drag the filesystem into the
// browser bundle. One string is a cheaper price than that. Keep the two in sync.
export const CONSENT_COOKIE = '_rc';

/** The visitor's own answer, readable because `_rc` is deliberately not HttpOnly. */
export function consent(): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(CONSENT_COOKIE + '='))
    ?.split('=')[1];
}

// How many events this tab has sent. The server uses it to tell a genuine first
// visit (n === 0, no cookie yet) from a visitor who blocks cookies (n > 0 and
// still no cookie) — without it, every blocked request would look like a brand
// new visitor and inflate the unique count. It is a per-tab counter, not an id:
// it identifies nothing and resets on reload.
let sent = 0;

function post(body: Record<string, unknown>): void {
  // The request is not sent at all without consent. /api/track refuses these
  // anyway, but a refusal the visitor can see in devtools is not a refusal —
  // "do not send analytics events" means the network stays quiet.
  if (consent() !== 'yes') return;

  // credentials: 'same-origin' is the fetch default, so the analytics cookies
  // ride along; keepalive lets the request survive the navigation that follows.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, n: sent++ }),
    keepalive: true,
  }).catch(() => {});
}

/** Also called by the banner, so accepting counts the page you accepted on. */
export function trackPageview(path: string): void {
  if (path.startsWith('/admin')) return;
  post({ type: 'pageview', path });
}

export function trackEvent(
  type: 'product_view' | 'search' | 'add_to_cart',
  data: { path?: string; productId?: number; query?: string } = {},
): void {
  post({ type, path: data.path ?? location.pathname, ...data });
}

export function Track() {
  const pathname = usePathname();
  const last = useRef<string>('');

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in dev; dedupe by path.
    if (last.current === pathname) return;
    last.current = pathname;

    // Never log the admin panel — it is our own traffic, not the store's.
    if (pathname.startsWith('/admin')) return;

    post({ type: 'pageview', path: pathname });
  }, [pathname]);

  useEffect(() => {
    // The banner fires this after a decision. Without it the page someone
    // accepted on would go uncounted, because its pageview effect already ran
    // while consent was still unanswered.
    const onConsent = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'yes') trackPageview(pathname);
    };
    window.addEventListener('consent:set', onConsent);
    return () => window.removeEventListener('consent:set', onConsent);
  }, [pathname]);

  return null;
}
