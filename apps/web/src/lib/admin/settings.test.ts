// UNIT VERIFIED — pure schema logic, no DB.
import { describe, expect, it } from 'vitest';
import { settingsInput } from './settingsValidation';

describe('settingsInput', () => {
  it('defaults every text field to empty string', () => {
    const result = settingsInput.parse({});
    expect(result.announcement).toBe('');
    expect(result.heroTitle).toBe('');
    expect(result.footerText).toBe('');
  });

  it('turns a blank heroImageUrl into null', () => {
    const result = settingsInput.parse({ heroImageUrl: '' });
    expect(result.heroImageUrl).toBeNull();
  });

  it('rejects an announcement over 300 characters', () => {
    expect(() => settingsInput.parse({ announcement: 'a'.repeat(301) })).toThrow();
  });
});
