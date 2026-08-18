// First-party analytics. No cookies, no third parties, no raw IP storage.
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

export type EventType = 'pageview' | 'product_view' | 'search' | 'add_to_cart' | 'purchase';

export type AnalyticsEvent = {
  t: string;        // ISO timestamp
  type: EventType;
  path: string;
  visitor: string;  // daily-rotating pseudonymous hash — not stable across days
  ref?: string;     // referrer host only, never the full URL
  productId?: number;
  query?: string;
  value?: number;   // order total in Rial, purchase events only
};

// Rotates daily so a visitor hash cannot be used to build a long-term profile.
// Random per-process salt means the hash is not reversible to an IP even with
// the source data — it is only useful for counting distinct visitors within a day.
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
