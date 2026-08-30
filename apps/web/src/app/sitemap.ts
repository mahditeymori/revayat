import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { getProducts } from '@/lib/commerce/products';
import { getCategories } from '@/lib/commerce/categories';
import { safe } from '@/lib/safe';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    safe(getProducts(), []),
    safe(getCategories(), []),
  ]);

  return [
    { url: site.url, changeFrequency: 'daily', priority: 1 },
    { url: `${site.url}/collections`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site.url}/search`, changeFrequency: 'weekly', priority: 0.3 },
    { url: `${site.url}/about`, changeFrequency: 'monthly', priority: 0.3 },
    ...categories.map((category) => ({
      url: `${site.url}/collections/${category.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${site.url}/products/${product.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
