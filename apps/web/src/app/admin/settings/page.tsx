import { getSettings } from '@/lib/catalog';
import { SettingsForm } from './SettingsForm';
import { requireAdminPage } from '@/lib/admin';

export default async function AdminSettingsPage() {
  // Layouts do not gate the pages beneath them — see requireAdminPage.
  await requireAdminPage();

  const settings = await getSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">تنظیمات سایت</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
