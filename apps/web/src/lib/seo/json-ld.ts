import { site } from '@/lib/site';

// Organization + WebSite structured data, rendered on every page (see
// layout.tsx). This is what tells Google "روایت شاپ" and "Revayat Shop"
// both name the same entity at site.url — Organization.name carries the
// Persian brand, alternateName covers the Latin form, and WebSite ties both
// to the domain.
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.nameFa,
    alternateName: [site.nameEn, site.name],
    url: site.url,
    logo: `${site.url}${site.logo}`,
    description: site.description,
    sameAs: [site.socials.instagram],
  } as const;
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.nameFa,
    alternateName: [site.nameEn, site.name],
    url: site.url,
    inLanguage: 'fa-IR',
    publisher: { '@type': 'Organization', name: site.nameFa },
  } as const;
}
