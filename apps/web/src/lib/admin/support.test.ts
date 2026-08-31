// UNIT VERIFIED — pure schema logic, no DB.
// Sanitization (DOMPurify) happens in support.ts's createSupportPage/updateSupportPage
// and slug-uniqueness is DB-bound — both DB INTEGRATION UNVERIFIED here.
import { describe, expect, it } from 'vitest';
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
