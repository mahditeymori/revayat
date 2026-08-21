import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAnswer } from './faq.ts';

test('matches shipping-time question by keyword', () => {
  const result = findAnswer('ارسال سفارش من چند روز طول میکشه؟');
  assert.equal(result?.id, 'shipping-time');
});

test('matches size-guide via a different phrasing', () => {
  const result = findAnswer('راهنمای سایز میخوام');
  assert.equal(result?.id, 'size-guide');
});

test('returns null for unrelated input', () => {
  assert.equal(findAnswer('قیمت دلار امروز چنده'), null);
});

test('returns null for empty input', () => {
  assert.equal(findAnswer('   '), null);
});
