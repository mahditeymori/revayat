import 'server-only';
import { createHmac, randomBytes } from 'crypto';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db/client';
import { admins, adminSessions } from '@/db/schema';
import { hasPermission, type AdminRole, type Permission } from './rbac';

export const COOKIE = 'revayat_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminUser = { id: string; email: string; role: AdminRole };
export type AdminSession = { admin: AdminUser; sessionId: string };

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error('ADMIN_SESSION_SECRET is not set');
  return value;
}

// Raw tokens are never stored — only this HMAC digest. A DB leak of
// admin_sessions therefore yields no usable session without also knowing
// ADMIN_SESSION_SECRET, on top of the token already being unguessable.
function hashToken(token: string): string {
  return createHmac('sha256', secret()).update(token).digest('hex');
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const proto = (await headers()).get('x-forwarded-proto');
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/admin',
    expires: expiresAt,
  });
}

export async function createSession(adminId: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();

  await db.insert(adminSessions).values({
    adminId,
    tokenHash: hashToken(token),
    userAgent: h.get('user-agent'),
    ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip'),
    expiresAt,
  });

  await setSessionCookie(token, expiresAt);
}

// Validates a raw token against the DB (hash + expiry + admin.active).
// Exported so proxy.ts — which reads the cookie off NextRequest, not
// next/headers — can run the exact same check at the request boundary
// without duplicating the query.
export async function getSessionByToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const row = await db
    .select({
      sessionId: adminSessions.id,
      adminId: admins.id,
      email: admins.email,
      role: admins.role,
      active: admins.active,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(and(eq(adminSessions.tokenHash, tokenHash), gt(adminSessions.expiresAt, new Date())))
    .then((rows) => rows[0]);

  if (!row || !row.active) return null;
  return { admin: { id: row.adminId, email: row.email, role: row.role }, sessionId: row.sessionId };
}

// Reads + validates the current request's session cookie. Returns null for
// any invalid/expired/deactivated case — callers that need to guarantee
// unauthenticated visitors never see protected data must use requireAdmin()
// below, not this directly.
export async function getSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return getSessionByToken(token);
}

export async function destroySession(): Promise<void> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  (await cookies()).delete({ name: COOKIE, path: '/admin' });
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
}

export async function revokeAllSessionsForAdmin(adminId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
}

/**
 * Gate a page's DATA, not just its chrome — layouts render alongside pages,
 * not before them, so a page must call this itself before reading anything.
 * notFound() rather than a redirect: an unauthorized request sees the
 * ordinary 404, not a hint that /admin/... exists.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) notFound();
  return session;
}

export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!hasPermission(session.admin.role, permission)) notFound();
  return session;
}
