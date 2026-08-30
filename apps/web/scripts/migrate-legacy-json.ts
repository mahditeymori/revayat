// One-time migration from the old flat-JSON catalog (data/products.json,
// data/settings.json) into the relational schema. Every product's flat
// sizes[] x colors[] becomes a cross product of product_variants rows — the
// old data has no per-variant stock, so each variant is seeded with
// DEFAULT_VARIANT_STOCK; an admin adjusts real counts afterward via the
// inventory admin page. Idempotent: re-running skips any slug that already
// exists as a product.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { categories, productImages, products, productVariants, siteSettings } from '../src/db/schema';
import { normalizePersian } from '../src/lib/search/normalize';

const DEFAULT_VARIANT_STOCK = 20;

type LegacyCategory = { slug: string; name: string; description: string };
type LegacyProduct = {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  priceRial: number;
  salePriceRial: number | null;
  images: string[];
  category: string;
  sizes: string[];
  colors: string[];
  inStock: boolean;
  featured: boolean;
};
type LegacyCatalog = { categories: LegacyCategory[]; products: LegacyProduct[] };
type LegacySettings = {
  announcement: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  footerText: string;
};

function skuFor(slug: string, size: string, color: string): string {
  const colorCode = normalizePersian(color).replace(/\s+/g, '-');
  return `${slug}-${size}-${colorCode}`.toUpperCase();
}

async function migrateCatalog() {
  const raw = await readFile(path.join(import.meta.dirname, '../data/products.json'), 'utf-8');
  const catalog: LegacyCatalog = JSON.parse(raw);

  const categoryIdBySlug = new Map<string, string>();
  for (const [index, category] of catalog.categories.entries()) {
    const [row] = await db
      .insert(categories)
      .values({ slug: category.slug, name: category.name, description: category.description, sortOrder: index })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: category.name, description: category.description },
      })
      .returning({ id: categories.id, slug: categories.slug });
    categoryIdBySlug.set(row.slug, row.id);
  }

  let migrated = 0;
  let skipped = 0;

  for (const legacy of catalog.products) {
    const existing = await db.query.products.findFirst({ where: eq(products.slug, legacy.slug) });
    if (existing) {
      skipped++;
      continue;
    }

    const searchText = normalizePersian(`${legacy.name} ${legacy.subtitle} ${legacy.description}`);
    const [product] = await db
      .insert(products)
      .values({
        slug: legacy.slug,
        name: legacy.name,
        subtitle: legacy.subtitle,
        description: legacy.description,
        priceRial: legacy.priceRial,
        salePriceRial: legacy.salePriceRial,
        categoryId: categoryIdBySlug.get(legacy.category) ?? null,
        featured: legacy.featured,
        active: legacy.inStock,
        normalizedSearchText: searchText,
      })
      .returning({ id: products.id });

    if (legacy.images.length > 0) {
      await db.insert(productImages).values(
        legacy.images.map((url, index) => ({
          productId: product.id,
          url,
          sortOrder: index,
        })),
      );
    }

    const sizes = legacy.sizes.length > 0 ? legacy.sizes : [null];
    const colors = legacy.colors.length > 0 ? legacy.colors : [null];
    const variantRows = sizes.flatMap((size) =>
      colors.map((color) => ({
        productId: product.id,
        size,
        color,
        sku: size && color ? skuFor(legacy.slug, size, color) : null,
        stock: legacy.inStock ? DEFAULT_VARIANT_STOCK : 0,
      })),
    );
    await db.insert(productVariants).values(variantRows);

    migrated++;
  }

  console.log(`[migrate-legacy-json] products: ${migrated} migrated, ${skipped} already existed`);
}

async function migrateSettings() {
  const raw = await readFile(path.join(import.meta.dirname, '../data/settings.json'), 'utf-8');
  const settings: LegacySettings = JSON.parse(raw);

  await db
    .insert(siteSettings)
    .values({
      id: 1,
      announcement: settings.announcement,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      heroImageUrl: settings.heroImage,
      footerText: settings.footerText,
    })
    .onConflictDoNothing({ target: siteSettings.id });

  console.log('[migrate-legacy-json] site settings migrated');
}

async function main() {
  await migrateCatalog();
  await migrateSettings();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
