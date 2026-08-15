import type { MetadataRoute } from 'next';
import { getProducts, getCategories, safe } from '@/lib/catalog';
import { site } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    safe(getProducts(), []),
    safe(getCategories(), []),
  ]);

  return [
    { url: site.url, changeFrequency: 'daily', priority: 1 },
    { url: `${site.url}/collections`, changeFrequency: 'weekly', priority: 0.8 },
    ...categories.map((c) => ({
      url: `${site.url}/collections/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${site.url}/products/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ];
}
