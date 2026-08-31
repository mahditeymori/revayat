import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { faqs, supportPages } from '@/db/schema';

export const listSupportPages = unstable_cache(
  async () => db.select().from(supportPages).orderBy(asc(supportPages.slug)),
  ['support-pages-list'],
  { tags: ['support-pages'] },
);

export const getSupportPage = unstable_cache(
  async (slug: string) => db.query.supportPages.findFirst({ where: eq(supportPages.slug, slug) }),
  ['support-page-by-slug'],
  { tags: ['support-pages'] },
);

export const getFaqs = unstable_cache(
  async () => db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
  ['faqs-list'],
  { tags: ['faqs'] },
);
