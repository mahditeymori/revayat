import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE, getSessionByToken } from '@/lib/admin/session';
import { hasPermission, permissionForPath } from '@/lib/admin/rbac';

// requireAdmin()/requirePermission() (src/lib/admin/session.ts) call
// notFound() to gate protected admin pages, but in this Next version a
// component's notFound() can't change the HTTP status once the route has
// started streaming its shell as 200 — see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md
// ("Calling notFound() after streaming has started"). Proxy runs before any
// route renders (Next 16 Proxy defaults to the Node.js runtime, so a real DB
// lookup here is safe), so it does the SAME session+permission check
// requireAdmin()/requirePermission() do and returns a real 404 before
// streaming starts. This is additive defense-in-depth: every page still
// calls requireAdmin()/requirePermission() itself, unchanged.
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/logout'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const session = await getSessionByToken(request.cookies.get(COOKIE)?.value);
  if (!session) {
    return NextResponse.rewrite(new URL('/admin/__proxy_notfound__', request.url));
  }

  const permission = permissionForPath(pathname);
  if (permission && !hasPermission(session.admin.role, permission)) {
    return NextResponse.rewrite(new URL('/admin/__proxy_notfound__', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
