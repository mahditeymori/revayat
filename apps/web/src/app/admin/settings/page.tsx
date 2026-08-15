import { getSettings } from '@/lib/catalog';
import { SettingsForm } from './SettingsForm';

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">تنظیمات سایت</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
