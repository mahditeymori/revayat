import { describe, expect, it } from 'vitest';
import { organizationJsonLd, websiteJsonLd } from './json-ld';

describe('organizationJsonLd', () => {
  it('names the Persian brand and carries the Latin form as alternateName', () => {
    const schema = organizationJsonLd();
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('روایت شاپ');
    expect(schema.alternateName).toContain('Revayat Shop');
    expect(schema.url).toBe('https://revayat.shop');
  });

  it('points logo at an absolute URL', () => {
    expect(organizationJsonLd().logo.startsWith('https://revayat.shop/')).toBe(true);
  });
});

describe('websiteJsonLd', () => {
  it('names the Persian brand and carries the Latin form as alternateName', () => {
    const schema = websiteJsonLd();
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('روایت شاپ');
    expect(schema.alternateName).toContain('Revayat Shop');
    expect(schema.inLanguage).toBe('fa-IR');
  });
});
