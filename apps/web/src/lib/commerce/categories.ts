import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { categories, products } from '@/db/schema';
import type { Category } from './types';

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  productCount: number;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    productCount: row.productCount,
    image: row.imageUrl ? { url: row.imageUrl, altText: row.name } : null,
  };
}

const categorySelection = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
  description: categories.description,
  imageUrl: categories.imageUrl,
  productCount: sql<number>`count(${products.id}) filter (where ${products.active})::int`,
};

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const rows = await db
      .select(categorySelection)
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder);
    return rows.map(mapCategory);
  },
  ['commerce:categories'],
  { tags: ['categories'] },
);

export const getCategory = unstable_cache(
  async (slug: string): Promise<Category | null> => {
    const rows = await db
      .select(categorySelection)
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .where(and(eq(categories.slug, slug)))
      .groupBy(categories.id);
    const row = rows[0];
    return row ? mapCategory(row) : null;
  },
  ['commerce:category'],
  { tags: ['categories'] },
);
