// First-party analytics. No third parties, no raw IP storage.
//
// Storage is one NDJSON file per UTC day in DATA_DIR/analytics/. Appending a
// line is atomic enough for this volume, and pruning old data is `rm` rather
// than a migration. This is deliberately a ceiling, not a design goal — see
// the note on SQLite at the bottom.
import { promises as fs } from 'fs';
import { createHash, randomBytes } from 'crypto';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const EVENTS_DIR = path.join(DATA_DIR, 'analytics');

/** Days of raw event data to keep. Older files are deleted on write. */
const RETENTION_DAYS = 90;

export type EventType =
  | 'pageview'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'purchase'
  | 'consent';

export type AnalyticsEvent = {
  t: string;        // ISO timestamp
  type: EventType;
  path: string;
  visitor: string;  // opaque visitor id (cookie) or daily hash fallback
  session?: string; // opaque session id — 30min idle window
  ref?: string;     // referrer host only, never the full URL
  productId?: number;
  query?: string;
  value?: number;   // order total in Rial, purchase events only
  decision?: Consent; // consent events only
  consented?: boolean; // purchase events only — see the funnel note in reports.ts
};

// ---------------------------------------------------------------------------
// Visitor identity
//
// Two first-party cookies, both holding a random opaque id and nothing else.
// They are not derived from the IP, the user agent, or anything the visitor
// typed, so there is nothing personal to leak even if the file is read — the id
// is meaningless outside this site's own event log.
//
//   _rv  visitor  180 days   distinguishes new from returning
//   _rs  session   30 min    one visit; the sliding expiry IS the idle timeout
//
// The 30-minute sliding window is the standard session definition: the cookie
// is re-set on every event, so it only lapses after 30 minutes of no activity.
//
// Neither is issued until the visitor accepts the banner — see `_rc` below.
// ---------------------------------------------------------------------------

export const VISITOR_COOKIE = '_rv';
export const SESSION_COOKIE = '_rs';
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
export const SESSION_MAX_AGE = 60 * 30; // 30 minutes, sliding

// ---------------------------------------------------------------------------
// Consent
//
// `_rc` records the visitor's answer to the banner. It is NOT an analytics
// cookie: it holds the literal string "yes" or "no" and is set on both answers,
// because "do not track me" is only honourable if we can remember it. Storing
// the refusal is what stops the banner reappearing on every page.
//
// It is deliberately readable by JavaScript (not HttpOnly) — the banner has to
// decide whether to render without a server round-trip, and there is nothing to
// protect in a value the visitor chose themselves.
// ---------------------------------------------------------------------------

export const CONSENT_COOKIE = '_rc';
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 180 days, same as the visitor id

export type Consent = 'yes' | 'no';

export const isConsent = (v: string | undefined): v is Consent => v === 'yes' || v === 'no';

/** Opaque random id. Not a hash of anything — nothing to reverse. */
export const newId = (): string => randomBytes(9).toString('base64url');

/** A cookie value we did not write is never trusted into the event log. */
export const isValidId = (v: string | undefined): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{12}$/.test(v);

// Fallback only, for visitors who block cookies: rotates daily so it cannot
// build a long-term profile, and the random per-process salt means it is not
// reversible to an IP even with the source data.
const SALT = randomBytes(32);

export function visitorHash(ip: string, ua: string, day: string): string {
  return createHash('sha256').update(SALT).update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 16);
}

export const dayKey = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

/** Referrer host only — full URLs can carry personal data in query strings. */
export function referrerHost(referer: string | null): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).hostname || undefined;
  } catch {
    return undefined;
  }
}

export async function record(event: AnalyticsEvent): Promise<void> {
  await fs.mkdir(EVENTS_DIR, { recursive: true });
  const file = path.join(EVENTS_DIR, `${event.t.slice(0, 10)}.ndjson`);
  await fs.appendFile(file, JSON.stringify(event) + '\n', 'utf8');
}

export async function pruneOld(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString().slice(0, 10);
  const files = await fs.readdir(EVENTS_DIR).catch(() => [] as string[]);
  await Promise.all(
    files
      .filter((f) => f.endsWith('.ndjson') && f.slice(0, 10) < cutoff)
      .map((f) => fs.rm(path.join(EVENTS_DIR, f), { force: true }).catch(() => {})),
  );
}

/** Read events for the last `days` days (inclusive of today). */
export async function readEvents(days = 30): Promise<AnalyticsEvent[]> {
  const wanted = new Set(
    Array.from({ length: days }, (_, i) => dayKey(new Date(Date.now() - i * 86400_000))),
  );
  const files = await fs.readdir(EVENTS_DIR).catch(() => [] as string[]);

  const chunks = await Promise.all(
    files
      .filter((f) => f.endsWith('.ndjson') && wanted.has(f.slice(0, 10)))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(EVENTS_DIR, f), 'utf8').catch(() => '');
        return raw
          .split('\n')
          .filter(Boolean)
          .flatMap((line) => {
            try {
              return [JSON.parse(line) as AnalyticsEvent];
            } catch {
              return []; // a torn final line must not break the whole dashboard
            }
          });
      }),
  );

  return chunks.flat().sort((a, b) => a.t.localeCompare(b.t));
}

// ponytail: NDJSON files, read fully into memory per dashboard load. Fine to
// roughly ~100k events/month on a small VM. Move to SQLite (better-sqlite3,
// one table + indexes on (t, type)) when the dashboard feels slow or retention
// needs to exceed 90 days.
