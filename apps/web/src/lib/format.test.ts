// Run: npm test   (node --test --experimental-strip-types, no framework)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigits,
  toPersianDigits,
  normalizePersian,
  slugifyPersian,
  formatToman,
  wooPriceToRial,
  discountPercent,
  formatJalali,
} from './format.ts';

test('digit normalization round-trips', () => {
  assert.equal(normalizeDigits('۱۲۳۴۵'), '12345');
  assert.equal(normalizeDigits('١٢٣'), '123');
  assert.equal(normalizeDigits('۱٫۵'), '1.5');
  assert.equal(toPersianDigits(2049), '۲۰۴۹');
});

test('persian normalization folds ZWNJ and arabic letterforms', () => {
  assert.equal(normalizePersian('می‌روم'), normalizePersian('میروم'));
  assert.equal(normalizePersian('كتاب'), 'کتاب');
  assert.equal(normalizePersian('على'), 'علی');
});

test('slugs keep persian letters', () => {
  assert.equal(slugifyPersian('رستم و گردآفرید'), 'رستم-و-گردآفرید');
  assert.equal(slugifyPersian('  Damavand Tee 2  '), 'damavand-tee-2');
});

test('money stays integer rial, displays toman', () => {
  // A 450,000 toman shirt = 4,500,000 rial, however Woo reports it.
  assert.equal(wooPriceToRial('450000', 0, 'IRT'), 4_500_000);
  assert.equal(wooPriceToRial('4500000', 0, 'IRR'), 4_500_000);
  assert.equal(wooPriceToRial('45000000', 2, 'IRT'), 4_500_000);
  assert.equal(wooPriceToRial('not-a-number', 0), 0);
  assert.equal(formatToman(4_500_000), '۴۵۰٬۰۰۰ تومان');
  assert.equal(formatToman(4_500_000, { suffix: false }), '۴۵۰٬۰۰۰');
});

test('discount never overstates', () => {
  assert.equal(discountPercent(1000, 700), 30);
  assert.equal(discountPercent(1000, 999), 0); // 0.1% floors to 0
  assert.equal(discountPercent(1000, 1000), 0);
  assert.equal(discountPercent(0, 0), 0);
});

test('jalali formatting', () => {
  // 2025-08-11 UTC -> 20 Mordad 1404 in Tehran
  assert.equal(formatJalali('2025-08-11T09:00:00Z'), '۲۰ مرداد ۱۴۰۴');
  assert.equal(formatJalali('nonsense'), '');
});
