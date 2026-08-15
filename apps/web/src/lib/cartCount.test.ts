// Run: npm test   (node --test --experimental-strip-types, no framework)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readCartCount } from './cartCount.ts';

test('readCartCount parses the count cookie', () => {
  assert.equal(readCartCount('revayat_cart_count=3'), 3);
  assert.equal(readCartCount('a=1; revayat_cart_count=12; b=2'), 12);
  assert.equal(readCartCount('other_cart_count=5'), 0);
  assert.equal(readCartCount(''), 0);
  assert.equal(readCartCount('revayat_cart_count=99999'), 999); // capped
  assert.equal(readCartCount('revayat_cart_count=abc'), 0);
});
