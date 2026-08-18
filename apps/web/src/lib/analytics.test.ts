// Run: npm test   (node --test --experimental-strip-types, no framework)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, isValidId, visitorHash, referrerHost, VISITOR_MAX_AGE, SESSION_MAX_AGE } from './analytics.ts';

test('newId produces distinct opaque ids that validate', () => {
  const a = newId();
  const b = newId();
  assert.notEqual(a, b);
  assert.ok(isValidId(a));
  assert.ok(isValidId(b));
});

test('isValidId rejects anything we did not write', () => {
  // the cookie is attacker-controlled, so this is the trust boundary
  assert.equal(isValidId(undefined), false);
  assert.equal(isValidId(''), false);
  assert.equal(isValidId('short'), false);
  assert.equal(isValidId('a'.repeat(500)), false); // no unbounded value into the log
  assert.equal(isValidId('../../etc/passwd'), false);
  assert.equal(isValidId('abc\ndef\nghi123'), false); // NDJSON: a newline would forge a row
  assert.equal(isValidId('{"x":1}12345'), false);
});

test('visitorHash is stable per day and unlinkable across days', () => {
  const a = visitorHash('1.2.3.4', 'UA', '2026-08-18');
  assert.equal(a, visitorHash('1.2.3.4', 'UA', '2026-08-18'));
  assert.notEqual(a, visitorHash('1.2.3.4', 'UA', '2026-08-19'));
  assert.notEqual(a, visitorHash('9.9.9.9', 'UA', '2026-08-18'));
  assert.ok(!a.includes('1.2.3.4')); // never echoes the input back
});

test('referrerHost keeps the host and discards the rest of the URL', () => {
  // the full URL can carry search terms and personal data in its query string
  assert.equal(referrerHost('https://google.com/search?q=secret'), 'google.com');
  assert.equal(referrerHost('not a url'), undefined);
  assert.equal(referrerHost(null), undefined);
});

test('cookie lifetimes stay short: session 30min, visitor 180 days', () => {
  assert.equal(SESSION_MAX_AGE, 1800);
  assert.ok(VISITOR_MAX_AGE <= 60 * 60 * 24 * 180);
});
