'use client';

// Fires one pageview per route change. Kept in the root layout so it also
// covers client-side navigations, which a server-side middleware hook misses.
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// How many events this tab has sent. The server uses it to tell a genuine first
// visit (n === 0, no cookie yet) from a visitor who blocks cookies (n > 0 and
// still no cookie) — without it, every blocked request would look like a brand
// new visitor and inflate the unique count. It is a per-tab counter, not an id:
// it identifies nothing and resets on reload.
let sent = 0;

function post(body: Record<string, unknown>): void {
  // credentials: 'same-origin' is the fetch default, so the analytics cookies
  // ride along; keepalive lets the request survive the navigation that follows.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, n: sent++ }),
    keepalive: true,
  }).catch(() => {});
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

  return null;
}
