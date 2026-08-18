// Pageview + event ingest. Called from the client beacon (components/Track.tsx)
// rather than middleware so prefetches and bot traffic that never render a page
// are not counted.
import { NextResponse } from 'next/server';
import { record, visitorHash, dayKey, referrerHost, pruneOld, type EventType } from '@/lib/analytics';

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
  let body: { type?: string; path?: string; productId?: number; query?: string };
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

  const day = dayKey();
  const visitor = visitorHash(ip, ua, day);
  if (!allowed(visitor)) return NextResponse.json({ ok: false }, { status: 429 });

  await record({
    t: new Date().toISOString(),
    type,
    path,
    visitor,
    ref: referrerHost(headers.get('referer')),
    productId: typeof body.productId === 'number' ? body.productId : undefined,
    query: typeof body.query === 'string' ? body.query.slice(0, 80) : undefined,
  });

  // Piggyback retention on write traffic — no cron needed.
  if (Math.floor(Date.now() / 1000) % 500 === 0) await pruneOld().catch(() => {});

  return NextResponse.json({ ok: true });
}
