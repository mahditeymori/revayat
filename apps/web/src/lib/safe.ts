// Next traces/prerenders every route it can during `next build`, which runs
// against a fake DATABASE_URL (see Dockerfile) with no reachable database.
// Wrap any commerce data call that can execute at build time in this so a
// down/unreachable DB degrades to an empty fallback instead of failing the
// build — real data arrives once the page is revalidated against the live DB.
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error('[commerce]', err instanceof Error ? err.message : err);
    return fallback;
  }
}
