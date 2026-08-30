import 'server-only';
import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import {
  categories,
  inventoryReservations,
  productImages,
  productVariants,
  products,
} from '@/db/schema';
import type { Image, Product, ProductOption, ProductVariant, SortKey } from './types';
import { toRial } from './types';

type BaseProductRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  priceRial: number;
  salePriceRial: number | null;
  categorySlug: string | null;
  featured: boolean;
};

type VariantRow = {
  id: string;
  productId: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  priceRial: number | null;
  compareAtPriceRial: number | null;
  stock: number;
  active: boolean;
  reservedQty: number | null;
};

type ImageRow = { productId: string; variantId: string | null; url: string; altText: string };

function variantTitle(size: string | null, color: string | null): string {
  return [size, color].filter(Boolean).join(' / ') || 'استاندارد';
}

function mapVariant(row: VariantRow, baseProductPriceRial: number): ProductVariant {
  const availableStock = row.stock - (row.reservedQty ?? 0);
  const selectedOptions = [
    ...(row.size ? [{ name: 'اندازه', value: row.size }] : []),
    ...(row.color ? [{ name: 'رنگ', value: row.color }] : []),
  ];
  return {
    id: row.id,
    sku: row.sku,
    title: variantTitle(row.size, row.color),
    availableForSale: row.active && availableStock > 0,
    stock: Math.max(availableStock, 0),
    selectedOptions,
    price: toRial(row.priceRial ?? baseProductPriceRial),
    compareAtPrice: row.compareAtPriceRial != null ? toRial(row.compareAtPriceRial) : null,
  };
}

function buildOptions(variants: VariantRow[]): ProductOption[] {
  const sizes = [...new Set(variants.map((v) => v.size).filter((v): v is string => v != null))];
  const colors = [...new Set(variants.map((v) => v.color).filter((v): v is string => v != null))];
  const options: ProductOption[] = [];
  if (sizes.length > 0) options.push({ id: 'size', name: 'اندازه', values: sizes });
  if (colors.length > 0) options.push({ id: 'color', name: 'رنگ', values: colors });
  return options;
}

async function fetchVariantsByProductIds(productIds: string[]): Promise<Map<string, VariantRow[]>> {
  if (productIds.length === 0) return new Map();

  const reserved = db
    .select({
      variantId: inventoryReservations.variantId,
      reservedQty: sql<number>`sum(${inventoryReservations.quantity})`.as('reserved_qty'),
    })
    .from(inventoryReservations)
    .where(inArray(inventoryReservations.status, ['reserved', 'confirmed']))
    .groupBy(inventoryReservations.variantId)
    .as('reserved');

  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      priceRial: productVariants.priceRial,
      compareAtPriceRial: productVariants.compareAtPriceRial,
      stock: productVariants.stock,
      active: productVariants.active,
      reservedQty: reserved.reservedQty,
    })
    .from(productVariants)
    .leftJoin(reserved, eq(reserved.variantId, productVariants.id))
    .where(inArray(productVariants.productId, productIds));

  const byProduct = new Map<string, VariantRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  return byProduct;
}

async function fetchImagesByProductIds(productIds: string[]): Promise<Map<string, ImageRow[]>> {
  if (productIds.length === 0) return new Map();

  const rows = await db
    .select({
      productId: productImages.productId,
      variantId: productImages.variantId,
      url: productImages.url,
      altText: productImages.altText,
    })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(asc(productImages.sortOrder));

  const byProduct = new Map<string, ImageRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  return byProduct;
}

// Shared by products.ts and search.ts: takes already-filtered/sorted/paginated
// base rows and hydrates each with its variants, options, and images. Fetches
// variants/images in two batched queries (not N+1 per product).
export async function hydrateProducts(baseRows: BaseProductRow[]): Promise<Product[]> {
  if (baseRows.length === 0) return [];

  const productIds = baseRows.map((row) => row.id);
  const [variantsByProduct, imagesByProduct] = await Promise.all([
    fetchVariantsByProductIds(productIds),
    fetchImagesByProductIds(productIds),
  ]);

  return baseRows.map((row): Product => {
    const variantRows = variantsByProduct.get(row.id) ?? [];
    const imageRows = imagesByProduct.get(row.id) ?? [];
    const images: Image[] = imageRows.map((img) => ({ url: img.url, altText: img.altText || row.name }));

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subtitle: row.subtitle,
      description: row.description,
      images,
      options: buildOptions(variantRows),
      variants: variantRows.map((v) => mapVariant(v, row.priceRial)),
      price: toRial(row.priceRial),
      salePrice: row.salePriceRial != null ? toRial(row.salePriceRial) : null,
      categorySlug: row.categorySlug,
      featured: row.featured,
    };
  });
}

function sortClause(sort: SortKey | undefined) {
  const effectivePrice = sql`coalesce(${products.salePriceRial}, ${products.priceRial})`;
  switch (sort) {
    case 'price-asc':
      return asc(effectivePrice);
    case 'price-desc':
      return desc(effectivePrice);
    case 'newest':
      return desc(products.createdAt);
    case 'relevance':
    default:
      return desc(sql`(${products.featured})::int`);
  }
}

export type GetProductsParams = {
  categorySlug?: string;
  featured?: boolean;
  onSale?: boolean;
  sort?: SortKey;
};

export const getProducts = unstable_cache(
  async (params: GetProductsParams = {}): Promise<Product[]> => {
    const conditions: SQL[] = [eq(products.active, true)];
    if (params.categorySlug) conditions.push(eq(categories.slug, params.categorySlug));
    if (params.featured != null) conditions.push(eq(products.featured, params.featured));
    if (params.onSale) conditions.push(isNotNull(products.salePriceRial));

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
      .orderBy(sortClause(params.sort));

    return hydrateProducts(baseRows);
  },
  ['commerce:products'],
  { tags: ['products'] },
);

export const getProduct = unstable_cache(
  async (slug: string): Promise<Product | null> => {
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
      .where(and(eq(products.slug, slug), eq(products.active, true)));

    const [hydrated] = await hydrateProducts(baseRows);
    return hydrated ?? null;
  },
  ['commerce:product'],
  { tags: ['products'] },
);

export const getProductRecommendations = unstable_cache(
  async (productId: string): Promise<Product[]> => {
    const current = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { categoryId: true },
    });

    const conditions: SQL[] = [eq(products.active, true), sql`${products.id} != ${productId}`];
    if (current?.categoryId) conditions.push(eq(products.categoryId, current.categoryId));

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
      .orderBy(desc(products.featured), desc(products.createdAt))
      .limit(4);

    return hydrateProducts(baseRows);
  },
  ['commerce:product-recommendations'],
  { tags: ['products'] },
);
