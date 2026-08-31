'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { settingsInput, updateSiteSettings } from '@/lib/admin/settings';

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requirePermission('settings.manage');
  const input = settingsInput.parse({
    announcement: formData.get('announcement') ?? '',
    heroTitle: formData.get('heroTitle') ?? '',
    heroSubtitle: formData.get('heroSubtitle') ?? '',
    heroImageUrl: formData.get('heroImageUrl') ?? '',
    footerText: formData.get('footerText') ?? '',
  });
  await updateSiteSettings(input);
  redirect('/admin/settings');
}
