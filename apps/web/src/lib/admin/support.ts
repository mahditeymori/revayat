import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '@/db/client';
import { faqs, supportPages } from '@/db/schema';
import { supportPageInput, faqInput, type SupportPageInput, type FaqInput } from './supportValidation';

export { supportPageInput, faqInput };
export type { SupportPageInput, FaqInput };

export async function listSupportPagesAdmin() {
  return db.select().from(supportPages).orderBy(asc(supportPages.slug));
}

export async function getSupportPageAdmin(id: string) {
  return db.query.supportPages.findFirst({ where: eq(supportPages.id, id) });
}

async function assertSlugFree(slug: string, excludeId?: string) {
  const existing = await db.query.supportPages.findFirst({ where: eq(supportPages.slug, slug) });
  if (existing && existing.id !== excludeId) throw new Error('این اسلاگ قبلاً استفاده شده است.');
}

export async function createSupportPage(input: SupportPageInput) {
  await assertSlugFree(input.slug);
  const bodyHtml = DOMPurify.sanitize(input.bodyHtml);
  const [row] = await db.insert(supportPages).values({ ...input, bodyHtml, updatedAt: new Date() }).returning();
  updateTag('support-pages');
  return row;
}

export async function updateSupportPage(id: string, input: SupportPageInput) {
  await assertSlugFree(input.slug, id);
  const bodyHtml = DOMPurify.sanitize(input.bodyHtml);
  await db.update(supportPages).set({ ...input, bodyHtml, updatedAt: new Date() }).where(eq(supportPages.id, id));
  updateTag('support-pages');
}

export async function deleteSupportPage(id: string) {
  await db.delete(supportPages).where(eq(supportPages.id, id));
  updateTag('support-pages');
}

export async function listFaqsAdmin() {
  return db.select().from(faqs).orderBy(asc(faqs.sortOrder));
}

export async function createFaq(input: FaqInput) {
  const [row] = await db.insert(faqs).values(input).returning();
  updateTag('faqs');
  return row;
}

export async function updateFaq(id: string, input: FaqInput) {
  await db.update(faqs).set(input).where(eq(faqs.id, id));
  updateTag('faqs');
}

export async function deleteFaq(id: string) {
  await db.delete(faqs).where(eq(faqs.id, id));
  updateTag('faqs');
}

export async function reorderFaqs(ids: string[]) {
  await Promise.all(ids.map((id, index) => db.update(faqs).set({ sortOrder: index }).where(eq(faqs.id, id))));
  updateTag('faqs');
}
