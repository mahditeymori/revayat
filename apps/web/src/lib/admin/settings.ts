import 'server-only';
import { updateTag } from 'next/cache';
import { db } from '@/db/client';
import { siteSettings } from '@/db/schema';
import { settingsInput, type SettingsInput } from './settingsValidation';

export { settingsInput };
export type { SettingsInput };

export async function getSiteSettingsAdmin() {
  return db.query.siteSettings.findFirst({ where: (s, { eq }) => eq(s.id, 1) });
}

// Singleton row (id fixed at 1) — insert on first save, update thereafter.
export async function updateSiteSettings(input: SettingsInput) {
  await db
    .insert(siteSettings)
    .values({ id: 1, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.id, set: { ...input, updatedAt: new Date() } });
  updateTag('site-settings');
}
