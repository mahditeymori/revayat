// Records the visitor's answer to the cookie banner and sets `_rc`.
//
// Kept separate from /api/track because it must run for people who said NO —
// /api/track refuses everything without consent, which is exactly the point.
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import {
  record,
  isConsent,
  newId,
  isValidId,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  VISITOR_COOKIE,
  SESSION_COOKIE,
  VISITOR_MAX_AGE,
  SESSION_MAX_AGE,
  type Consent,
} from '@/lib/analytics';

export async function POST(req: Request): Promise<NextResponse> {
  let body: { decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const decision = body.decision;
  if (!isConsent(decision)) return NextResponse.json({ ok: false }, { status: 400 });

  const jar = await cookies();
  const h = await headers();
  const secure = h.get('x-forwarded-proto') === 'https';

  // Only the first answer, or a genuine change of mind, is recorded. Without
  // this, a client that re-posts its stored decision on every page load would
  // count one person hundreds of times — and "no" rows have no visitor id, so
  // they cannot be deduplicated later at read time.
  const previous = jar.get(CONSENT_COOKIE)?.value;
  const isNew = previous !== decision;

  // The consent cookie itself is readable by JS: the banner decides whether to
  // render client-side, and the visitor chose this value themselves.
  const res = NextResponse.json({ ok: true, decision });
  res.cookies.set(CONSENT_COOKIE, decision, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: CONSENT_MAX_AGE,
  });

  if (decision === 'no') {
    // Honour the refusal immediately: clear any ids from a previous "yes" so a
    // visitor who changes their mind is not left carrying an identifier.
    res.cookies.delete(VISITOR_COOKIE);
    res.cookies.delete(SESSION_COOKIE);
    // Logged WITHOUT a visitor id — "someone declined" is a count, not a person.
    // This is the only row in the log with no identity attached, and it is what
    // makes the opt-out rate in the admin panel possible without tracking the
    // people who opted out.
    if (isNew) {
      await record({
        t: new Date().toISOString(),
        type: 'consent',
        path: '/',
        visitor: 'anon',
        decision: 'no',
      }).catch(() => {});
    }
    return res;
  }

  return acceptedResponse(res, jar.get(VISITOR_COOKIE)?.value, secure, isNew);
}

/** Issue the analytics ids now, so the first pageview after Accept is counted. */
async function acceptedResponse(
  res: NextResponse,
  existing: string | undefined,
  secure: boolean,
  isNew: boolean,
): Promise<NextResponse> {
  const visitor = isValidId(existing) ? existing : newId();
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  res.cookies.set(VISITOR_COOKIE, visitor, { ...base, maxAge: VISITOR_MAX_AGE });
  res.cookies.set(SESSION_COOKIE, newId(), { ...base, maxAge: SESSION_MAX_AGE });

  if (isNew) {
    await record({
      t: new Date().toISOString(),
      type: 'consent',
      path: '/',
      visitor,
      decision: 'yes' as Consent,
    }).catch(() => {});
  }

  return res;
}
