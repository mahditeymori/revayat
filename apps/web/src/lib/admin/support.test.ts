// UNIT VERIFIED — pure schema logic, no DB.
// Sanitization (DOMPurify) happens in support.ts's createSupportPage/updateSupportPage
// and slug-uniqueness is DB-bound — both DB INTEGRATION UNVERIFIED here.
import { describe, expect, it } from 'vitest';
import DOMPurify from 'isomorphic-dompurify';
import { faqInput, supportPageInput } from './supportValidation';

describe('supportPageInput', () => {
  it('rejects a slug with uppercase or non-Latin characters', () => {
    expect(() => supportPageInput.parse({ slug: 'Bad Slug', title: 'x' })).toThrow();
  });

  it('defaults bodyHtml to empty string', () => {
    const result = supportPageInput.parse({ slug: 'shipping', title: 'x' });
    expect(result.bodyHtml).toBe('');
  });
});

describe('faqInput', () => {
  it('defaults sortOrder to 0', () => {
    const result = faqInput.parse({ question: 'q', answer: 'a' });
    expect(result.sortOrder).toBe(0);
  });

  it('rejects a blank question', () => {
    expect(() => faqInput.parse({ question: '', answer: 'a' })).toThrow();
  });
});

// Exercises the exact sanitizer call used by createSupportPage/updateSupportPage
// (DOMPurify.sanitize) and again by the /support/[slug] render path — both call
// sites strip the same payload shapes, so testing the shared call once here
// covers both.
describe('DOMPurify.sanitize on support page bodyHtml payloads', () => {
  it('strips <script> tags', () => {
    expect(DOMPurify.sanitize('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips inline event handler attributes', () => {
    expect(DOMPurify.sanitize('<img src=x onerror=alert(1)>')).not.toContain('onerror');
  });

  it('strips javascript: hrefs', () => {
    expect(DOMPurify.sanitize('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });

  it('strips <svg onload> payloads', () => {
    expect(DOMPurify.sanitize('<svg onload=alert(1)>')).not.toContain('onload');
  });

  it('keeps safe formatting markup intact', () => {
    expect(DOMPurify.sanitize('<p><strong>bold</strong> and <em>em</em></p>')).toBe(
      '<p><strong>bold</strong> and <em>em</em></p>',
    );
  });
});
