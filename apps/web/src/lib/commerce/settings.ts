import 'server-only';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { siteSettings } from '@/db/schema';

const DEFAULTS = { announcement: '', heroTitle: '', heroSubtitle: '', heroImageUrl: null as string | null, footerText: '' };

export const getSiteSettings = unstable_cache(
  async () => {
    const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
    return row ?? DEFAULTS;
  },
  ['site-settings'],
  { tags: ['site-settings'] },
);
