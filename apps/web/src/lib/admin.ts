// Admin auth: password from ADMIN_PASSWORD env, session = httpOnly cookie whose
// value is HMAC-SHA256(password, fixed label). Stateless (no session store),
// constant-time compared, and rotating the password invalidates all sessions.
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';

const COOKIE = 'revayat_admin';

function password(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function sessionToken(pw: string): string {
  return createHmac('sha256', pw).update('revayat-admin-session-v1').digest('hex');
}

export function checkPassword(input: string): boolean {
  const pw = password();
  if (!pw) return false; // no ADMIN_PASSWORD set -> admin disabled
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(): Promise<void> {
  const pw = password();
  if (!pw) return;
  // NODE_ENV is always "production" in Docker even when nginx terminates
  // plain HTTP (see cart.ts) — a Secure cookie there gets silently dropped.
  const proto = (await headers()).get('x-forwarded-proto');
  (await cookies()).set(COOKIE, sessionToken(pw), {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: '/admin' });
}

export async function isAdmin(): Promise<boolean> {
  const pw = password();
  if (!pw) return false;
  const got = (await cookies()).get(COOKIE)?.value ?? '';
  const expect = sessionToken(pw);
  const a = Buffer.from(got);
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gate a page's DATA, not just its chrome.
 *
 * The admin layout renders a login form for anonymous visitors, but a Next.js
 * layout does not stop the page beneath it from running: layout and page render
 * in parallel, and the page's output is serialised into the RSC payload of the
 * same response. The login screen therefore ships with the real orders,
 * customer phone numbers and payment details embedded in the HTML - invisible
 * on screen, plainly readable with curl.
 *
 * Every admin page must call this before it reads anything, so an unauthorised
 * request never loads the data in the first place. notFound() rather than a
 * redirect: it renders the ordinary 404 and does not confirm the route exists.
 */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) notFound();
}
