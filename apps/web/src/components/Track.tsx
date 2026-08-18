'use client';

// Fires one pageview per route change. Kept in the root layout so it also
// covers client-side navigations, which a server-side middleware hook misses.
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function trackEvent(
  type: 'product_view' | 'search' | 'add_to_cart',
  data: { path?: string; productId?: number; query?: string } = {},
): void {
  const body = JSON.stringify({ type, path: data.path ?? location.pathname, ...data });
  // keepalive so the request survives the navigation that often follows.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
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

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
