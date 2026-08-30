import { describe, expect, it } from 'vitest';
import { normalizePersian } from './normalize';

describe('normalizePersian', () => {
  it('canonicalizes Arabic-style ي/ك to Persian ی/ک', () => {
    expect(normalizePersian('كتاب')).toBe('کتاب');
    expect(normalizePersian('علي')).toBe('علی');
  });

  it('collapses the zero-width non-joiner (half-space) to a plain space', () => {
    expect(normalizePersian('می‌خواهم')).toBe(normalizePersian('می خواهم'));
  });

  it('converts Persian and Arabic digits to ASCII', () => {
    expect(normalizePersian('۱۲۳')).toBe('123');
    expect(normalizePersian('١٢٣')).toBe('123');
  });

  it('strips diacritics', () => {
    expect(normalizePersian('مُحَمَّد')).toBe('محمد');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizePersian('  دماوند   قله  ')).toBe('دماوند قله');
  });

  it('lowercases mixed Latin text', () => {
    expect(normalizePersian('REVAYAT شاپ')).toBe('revayat شاپ');
  });
});
