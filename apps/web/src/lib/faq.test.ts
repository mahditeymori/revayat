import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAnswer, DEFAULT_FAQ_ENTRIES } from './faq.ts';

test('matches shipping-time question by keyword', () => {
  const result = findAnswer('ارسال سفارش من چند روز طول میکشه؟', DEFAULT_FAQ_ENTRIES);
  assert.equal(result?.id, 'shipping-time');
});

test('matches size-guide via a different phrasing', () => {
  const result = findAnswer('راهنمای سایز میخوام', DEFAULT_FAQ_ENTRIES);
  assert.equal(result?.id, 'size-guide');
});

test('returns null for unrelated input', () => {
  assert.equal(findAnswer('قیمت دلار امروز چنده', DEFAULT_FAQ_ENTRIES), null);
});

test('returns null for empty input', () => {
  assert.equal(findAnswer('   ', DEFAULT_FAQ_ENTRIES), null);
});

test('works against a custom (admin-edited) entry list', () => {
  const custom = [{ id: 'x', question: 'گارانتی دارید؟', keywords: ['گارانتی'], answer: 'بله.' }];
  assert.equal(findAnswer('گارانتی چطوره', custom)?.id, 'x');
});
