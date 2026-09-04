import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import { categoryInput, type CategoryInput } from './categoryValidation';

export { categoryInput };
export type { CategoryInput };

export async function listCategoriesAdmin() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function getCategoryAdmin(id: string) {
  return db.query.categories.findFirst({ where: eq(categories.id, id) });
}

export async function createCategory(input: CategoryInput) {
  const existing = await db.query.categories.findFirst({ where: eq(categories.slug, input.slug) });
  if (existing) throw new Error('اسلاگ تکراری است.');
  const [row] = await db.insert(categories).values(input).returning();
  updateTag('categories');
  return row;
}

export async function updateCategory(id: string, input: CategoryInput) {
  const existing = await db.query.categories.findFirst({ where: eq(categories.slug, input.slug) });
  if (existing && existing.id !== id) throw new Error('اسلاگ تکراری است.');
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  updateTag('categories');
  return row;
}

export async function updateCategoryImage(id: string, imageUrl: string) {
  const [row] = await db.update(categories).set({ imageUrl }).where(eq(categories.id, id)).returning();
  updateTag('categories');
  return row;
}

// Archive, never DELETE: products.category_id is ON DELETE SET NULL, so a
// hard delete would silently orphan any product still assigned to this
// category. Archiving drops it from storefront listings without touching
// existing products.
export async function setCategoryActive(id: string, active: boolean) {
  const [row] = await db.update(categories).set({ active }).where(eq(categories.id, id)).returning();
  updateTag('categories');
  return row;
}
