import 'server-only';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { categories, products } from '@/db/schema';
import { normalizePersian } from '@/lib/search/normalize';
import { hydrateProducts } from './products';
import type { Product, SortKey } from './types';

export type SearchProductsParams = { categorySlug?: string; sort?: SortKey };

// Unions tsvector word/prefix matching with pg_trgm fuzzy matching, both over
// normalized_search_text — tsvector alone under-serves Persian morphology,
// trigram alone is too noisy to rank well without it.
export const searchProducts = unstable_cache(
  async (query: string, params: SearchProductsParams = {}): Promise<Product[]> => {
    const normalized = normalizePersian(query);
    if (!normalized) return [];

    const tsQuery = sql`plainto_tsquery('simple', ${normalized})`;
    const similarity = sql<number>`similarity(${products.normalizedSearchText}, ${normalized})`;
    const rank = sql<number>`ts_rank(${products.searchVector}, ${tsQuery})`;
    const relevance = sql`(${rank} * 2 + ${similarity})`;

    const conditions: SQL[] = [
      eq(products.active, true),
      sql`(${products.searchVector} @@ ${tsQuery} or ${similarity} > 0.15)`,
    ];
    if (params.categorySlug) conditions.push(eq(categories.slug, params.categorySlug));

    const orderBy =
      params.sort === 'price-asc'
        ? asc(sql`coalesce(${products.salePriceRial}, ${products.priceRial})`)
        : params.sort === 'price-desc'
          ? desc(sql`coalesce(${products.salePriceRial}, ${products.priceRial})`)
          : params.sort === 'newest'
            ? desc(products.createdAt)
            : desc(relevance);

    const baseRows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        subtitle: products.subtitle,
        description: products.description,
        priceRial: products.priceRial,
        salePriceRial: products.salePriceRial,
        categorySlug: categories.slug,
        featured: products.featured,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(orderBy);

    return hydrateProducts(baseRows);
  },
  ['commerce:search'],
  { tags: ['products'] },
);

export type { Product, SortKey };
