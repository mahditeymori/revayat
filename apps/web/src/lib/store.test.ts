// Run: npm test   (node --test --experimental-strip-types, no framework)
//
// The serialisation guarantee in mutate() is what makes duplicate Zibal
// callbacks safe: two concurrent callbacks must not both read the same
// "unverified" row and both proceed. These run against a real temp DATA_DIR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'revayat-store-'));
process.env.DATA_DIR = dir;

// Imported after DATA_DIR is set — the module reads it at load time.
const { mutate, readJson, writeJson } = await import('./store.ts');

test('writes survive a read round-trip', async () => {
  await writeJson('t1.json', { a: 1 });
  assert.deepEqual(await readJson('t1.json', null), { a: 1 });
});

test('a missing file returns the fallback rather than throwing', async () => {
  assert.deepEqual(await readJson('does-not-exist.json', []), []);
});

test('malformed JSON falls back instead of crashing the page', async () => {
  await fs.writeFile(path.join(dir, 't2.json'), '{ not json', 'utf8');
  assert.deepEqual(await readJson('t2.json', { safe: true }), { safe: true });
});

test('concurrent mutations do not lose writes', async () => {
  // Without the lock this is the classic lost-update: every appender reads the
  // same empty array and the last write wins with a single element.
  await writeJson('t3.json', []);
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      mutate<number[], void>('t3.json', [], (cur) => [[...cur, i], undefined]),
    ),
  );
  const final = await readJson<number[]>('t3.json', []);
  assert.equal(final.length, 25);
  assert.deepEqual([...final].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i));
});

test('exactly one concurrent claimant wins - the duplicate-callback guard', async () => {
  // The shape of claimVerification(): flip a flag, and only the caller that
  // actually flipped it proceeds to call /v1/verify.
  await writeJson('t4.json', { verified: false });
  const claim = () =>
    mutate<{ verified: boolean }, boolean>('t4.json', { verified: false }, (cur) =>
      cur.verified ? [cur, false] : [{ verified: true }, true],
    );

  const results = await Promise.all([claim(), claim(), claim(), claim()]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('a throwing mutation does not wedge the queue', async () => {
  await writeJson('t5.json', { n: 0 });
  const boom = mutate<{ n: number }, void>('t5.json', { n: 0 }, () => {
    throw new Error('boom');
  });
  await assert.rejects(boom, /boom/);
  // the next mutation on the same file must still run
  await mutate<{ n: number }, void>('t5.json', { n: 0 }, (cur) => [{ n: cur.n + 1 }, undefined]);
  assert.deepEqual(await readJson('t5.json', null), { n: 1 });
});

test.after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
