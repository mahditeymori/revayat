// Pageview + event ingest. Called from the client beacon (components/Track.tsx)
// rather than middleware so prefetches and bot traffic that never render a page
// are not counted.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  record,
  visitorHash,
  dayKey,
  referrerHost,
  pruneOld,
  newId,
  isValidId,
  VISITOR_COOKIE,
  SESSION_COOKIE,
  VISITOR_MAX_AGE,
  SESSION_MAX_AGE,
  type EventType,
} from '@/lib/analytics';

const TYPES: EventType[] = ['pageview', 'product_view', 'search', 'add_to_cart'];

// Cheap in-process throttle: one visitor cannot append unbounded events.
const seen = new Map<string, { n: number; resetAt: number }>();
const LIMIT = 120;
const WINDOW_MS = 60_000;

function allowed(key: string): boolean {
  const now = Date.now();
  const entry = seen.get(key);
  if (!entry || now > entry.resetAt) {
    seen.set(key, { n: 1, resetAt: now + WINDOW_MS });
    if (seen.size > 5000) for (const [k, v] of seen) if (now > v.resetAt) seen.delete(k);
    return true;
  }
  entry.n += 1;
  return entry.n <= LIMIT;
}

export async function POST(req: Request) {
  let body: { type?: string; path?: string; productId?: number; query?: string; n?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = body.type as EventType;
  if (!TYPES.includes(type)) return NextResponse.json({ ok: false }, { status: 400 });

  const path = String(body.path ?? '').slice(0, 200);
  if (!path.startsWith('/')) return NextResponse.json({ ok: false }, { status: 400 });

  const headers = req.headers;
  // X-Forwarded-For is set by our own nginx; only the first hop is meaningful.
  const ip = (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ua = headers.get('user-agent') ?? '';

  // Obvious crawlers would drown out real traffic in the reports.
  if (/bot|crawler|spider|crawling|preview|monitor/i.test(ua)) {
    return NextResponse.json({ ok: true });
  }

  // Identity comes from our own cookies. A value we did not write is discarded
  // rather than logged, so a crafted cookie cannot inflate or poison the counts.
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  const priorSession = jar.get(SESSION_COOKIE)?.value;

  // `n` is the client's event counter for this tab. A request with n > 0 and no
  // cookie means the cookie we already set did not come back — the visitor is
  // blocking cookies. Minting a fresh id for each of those would count one
  // person as many visitors, so they fall back to the daily hash, which at
  // least dedupes them within a day. n === 0 is a genuine first visit.
  const blocked = !isValidId(existing) && Number(body.n) > 0;
  const day = dayKey();

  const visitor = isValidId(existing) ? existing : blocked ? visitorHash(ip, ua, day) : newId();
  const returning = isValidId(existing);
  const session = isValidId(priorSession) ? priorSession : blocked ? visitor : newId();

  if (!allowed(visitor)) return NextResponse.json({ ok: false }, { status: 429 });

  await record({
    t: new Date().toISOString(),
    type,
    path,
    visitor,
    session,
    ref: referrerHost(headers.get('referer')),
    productId: typeof body.productId === 'number' ? body.productId : undefined,
    query: typeof body.query === 'string' ? body.query.slice(0, 80) : undefined,
  });

  // Piggyback retention on write traffic — no cron needed.
  if (Math.floor(Date.now() / 1000) % 500 === 0) await pruneOld().catch(() => {});

  const res = NextResponse.json({ ok: true, returning });
  // Secure follows the real request scheme, not NODE_ENV: the image is built in
  // production mode either way, and a Secure cookie on plain HTTP is dropped.
  const secure = headers.get('x-forwarded-proto') === 'https';
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  res.cookies.set(VISITOR_COOKIE, visitor, { ...base, maxAge: VISITOR_MAX_AGE });
  // Re-set every event: the sliding expiry is what makes 30 min of inactivity
  // end the session.
  res.cookies.set(SESSION_COOKIE, session, { ...base, maxAge: SESSION_MAX_AGE });
  return res;
}
