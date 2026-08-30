import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// /admin and /api don't exist as routes yet on this branch, but disallowing
// them now costs nothing and matches the convention the storefront will
// ship with once those routes land — nothing here should ever be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/cart', '/checkout'],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
