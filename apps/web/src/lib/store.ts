// Shared JSON file store for DATA_DIR. Used by catalog.ts (products, settings,
// orders) and payments.ts.
//
// Writes are tmp+rename so a crash mid-write cannot leave a torn file, and
// read-modify-write cycles go through `mutate`, which serialises per file.
// Serialisation matters for payments: two Zibal callbacks for different orders
// arriving at the same moment would otherwise each read the old array and the
// second write would drop the first payment entirely.
import { promises as fs } from 'fs';
import path from 'path';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');

export async function readJson<T>(file: string, fallback: T, tag = 'store'): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
  } catch {
    return fallback; // not created yet (e.g. orders.json before the first order)
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    // A malformed file is a real problem - falling back silently makes the site
    // look fine while serving default content. Loud, but still non-fatal.
    console.error(`[${tag}] ${file} is not valid JSON:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  const target = path.join(DATA_DIR, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

// One promise chain per file. Single-process only (the Docker image runs one
// Next server); a multi-replica deploy would need a real lock or a database.
const locks = new Map<string, Promise<unknown>>();

/**
 * Read a file, hand it to `fn`, and write back whatever `fn` returns - with no
 * other `mutate` on the same file interleaving. `fn` may return a value
 * alongside the next state via `[next, value]`.
 */
export function mutate<T, R>(
  file: string,
  fallback: T,
  fn: (current: T) => Promise<[T, R]> | [T, R],
  tag = 'store',
): Promise<R> {
  const previous = locks.get(file) ?? Promise.resolve();
  const next = previous
    .catch(() => {}) // one failed mutation must not wedge the queue forever
    .then(async () => {
      const current = await readJson<T>(file, fallback, tag);
      const [updated, value] = await fn(current);
      await writeJson(file, updated);
      return value;
    });
  locks.set(file, next);
  // Drop the entry once it is the tail, so the map does not grow without bound.
  next.catch(() => {}).finally(() => {
    if (locks.get(file) === next) locks.delete(file);
  });
  return next;
}
