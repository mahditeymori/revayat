import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { rateLimits } from '@/db/schema';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

// DB-backed sliding-window limiter, called directly from domain functions
// (admin login, checkout submission, payment start/retry, admin payment
// inquiry). There is no separate middleware.ts in this app — this IS the
// enforcement layer, deliberately placed in domain logic rather than a
// framework middleware so it can't be silently bypassed by a route that
// forgets to opt in to the middleware matcher.
export async function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = new Date();

  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now, updatedAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case
          when ${rateLimits.windowStart} <= ${now.toISOString()}::timestamptz - (${windowMs}::text || ' milliseconds')::interval
            then 1
          else ${rateLimits.count} + 1
        end`,
        windowStart: sql`case
          when ${rateLimits.windowStart} <= ${now.toISOString()}::timestamptz - (${windowMs}::text || ' milliseconds')::interval
            then ${now.toISOString()}::timestamptz
          else ${rateLimits.windowStart}
        end`,
        updatedAt: now,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  const row = rows[0];
  if (!row) return { allowed: true };

  if (row.count > limit) {
    const retryAfterMs = row.windowStart.getTime() + windowMs - now.getTime();
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { allowed: true };
}
