// UNIT VERIFIED — pure URL check, no DB.
import { describe, expect, it } from 'vitest';
import { isSafeMediaUrl, safeMediaUrl } from './urlValidation';

describe('isSafeMediaUrl', () => {
  it('accepts a same-origin upload path', () => {
    expect(isSafeMediaUrl('/api/uploads/categories/example.webp')).toBe(true);
  });

  it('accepts an absolute https URL', () => {
    expect(isSafeMediaUrl('https://cdn.example.com/x.webp')).toBe(true);
  });

  it('accepts an absolute http URL', () => {
    expect(isSafeMediaUrl('http://cdn.example.com/x.webp')).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeMediaUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects file: scheme', () => {
    expect(isSafeMediaUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects a bare relative path outside the uploads prefix', () => {
    expect(isSafeMediaUrl('/uploads/categories/x.webp')).toBe(false);
  });

  it('rejects an unparseable string', () => {
    expect(isSafeMediaUrl('not a url')).toBe(false);
  });
});

describe('safeMediaUrl schema', () => {
  it('turns an empty string into null', () => {
    expect(safeMediaUrl.parse('')).toBeNull();
  });

  it('defaults to null when omitted', () => {
    expect(safeMediaUrl.parse(undefined)).toBeNull();
  });

  it('passes through a valid upload path', () => {
    expect(safeMediaUrl.parse('/api/uploads/categories/x.webp')).toBe('/api/uploads/categories/x.webp');
  });

  it('throws on a javascript: URL', () => {
    expect(() => safeMediaUrl.parse('javascript:alert(1)')).toThrow();
  });
});
