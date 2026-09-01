import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// /admin and /api are internal-only — nothing under either should ever be indexed.
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
