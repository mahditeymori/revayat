import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// requireAdmin() (src/lib/admin/session.ts) calls notFound() to gate protected
// admin pages, but in this Next version a component's notFound() can't change
// the HTTP status once the route has started streaming its shell as 200 — see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md
// ("Calling notFound() after streaming has started"). Proxy runs before any
// route renders, so an optimistic cookie-presence check here can still produce
// a real 404 for the common case (no session cookie at all). This is
// intentionally NOT a full auth check — session validity (expiry, revocation,
// deactivated admin) still requires the DB lookup that only requireAdmin()
// does; that path keeps the existing content-correct/status-200 tradeoff.
const SESSION_COOKIE = 'revayat_admin_session';
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/logout'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.rewrite(new URL('/admin/__proxy_notfound__', request.url));
}

export const config = {
  matcher: '/admin/:path*',
};
