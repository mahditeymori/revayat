import 'server-only';
import { and, desc, eq, ilike, notInArray } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { db } from '@/db/client';
import { productImages, productVariants, products } from '@/db/schema';
import { normalizePersian } from '@/lib/search/normalize';
import { assertNoDuplicateVariants, productInput, variantInput, type ProductInput } from './productValidation';

export { assertNoDuplicateVariants, productInput, variantInput };
export type { ProductInput };

export async function listProductsAdmin(opts: { search?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const where = opts.search ? ilike(products.name, `%${opts.search}%`) : undefined;

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(desc(products.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return rows;
}

export async function getProductAdmin(id: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) return null;
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(productVariants.createdAt);
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(productImages.sortOrder);
  return { product, variants, images };
}

async function assertSlugFree(slug: string, excludeId?: string) {
  const existing = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  if (existing && existing.id !== excludeId) throw new Error('اسلاگ تکراری است.');
}

export async function createProduct(input: ProductInput) {
  assertNoDuplicateVariants(input.variants);
  await assertSlugFree(input.slug);

  const normalizedSearchText = normalizePersian(`${input.name} ${input.subtitle} ${input.description}`);
  const { variants, ...productFields } = input;

  const product = await db.transaction(async (tx) => {
    const [row] = await tx.insert(products).values({ ...productFields, normalizedSearchText }).returning();
    await tx.insert(productVariants).values(
      variants.map(({ id: _variantId, ...fields }) => ({ ...fields, productId: row.id })),
    );
    return row;
  });

  updateTag('products');
  return product;
}

export async function updateProduct(id: string, input: ProductInput) {
  assertNoDuplicateVariants(input.variants);
  await assertSlugFree(input.slug, id);

  const normalizedSearchText = normalizePersian(`${input.name} ${input.subtitle} ${input.description}`);
  const { variants, ...productFields } = input;
  const keepIds = variants.filter((v) => v.id).map((v) => v.id!);

  await db.transaction(async (tx) => {
    await tx.update(products).set({ ...productFields, normalizedSearchText }).where(eq(products.id, id));

    // Variants referenced by past order_items are protected by ON DELETE
    // RESTRICT, so a variant that was ever sold can't actually be removed
    // here — that's intentional, not a bug to work around.
    if (keepIds.length > 0) {
      await tx
        .delete(productVariants)
        .where(and(eq(productVariants.productId, id), notInArray(productVariants.id, keepIds)));
    } else {
      await tx.delete(productVariants).where(eq(productVariants.productId, id));
    }

    for (const v of variants) {
      const { id: variantId, ...fields } = v;
      if (variantId) {
        await tx.update(productVariants).set(fields).where(eq(productVariants.id, variantId));
      } else {
        await tx.insert(productVariants).values({ ...fields, productId: id });
      }
    }
  });

  updateTag('products');
}

export async function setProductActive(id: string, active: boolean) {
  await db.update(products).set({ active }).where(eq(products.id, id));
  updateTag('products');
}

export async function addProductImages(
  productId: string,
  images: { url: string; altText?: string; variantId?: string | null }[],
) {
  if (images.length === 0) return;
  const [{ max }] = await db
    .select({ max: productImages.sortOrder })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(desc(productImages.sortOrder))
    .limit(1);
  let sortOrder = (max ?? -1) + 1;
  await db.insert(productImages).values(
    images.map((img) => ({
      productId,
      url: img.url,
      altText: img.altText ?? '',
      variantId: img.variantId ?? null,
      sortOrder: sortOrder++,
    })),
  );
  updateTag('products');
}

export async function deleteProductImage(imageId: string) {
  await db.delete(productImages).where(eq(productImages.id, imageId));
  updateTag('products');
}

export async function reorderProductImages(imageIds: string[]) {
  if (imageIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, id] of imageIds.entries()) {
      await tx.update(productImages).set({ sortOrder: index }).where(eq(productImages.id, id));
    }
  });
  updateTag('products');
}
