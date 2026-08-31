export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import { getSiteSettingsAdmin } from '@/lib/admin/settings';
import { updateSettingsAction } from './actions';

export default async function SettingsPage() {
  await requirePermission('settings.manage');
  const settings = await getSiteSettingsAdmin();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-medium text-slate-900">تنظیمات سایت</h1>
      <form action={updateSettingsAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="نوار اعلان (بالای سایت)" name="announcement" defaultValue={settings?.announcement} />
        <Field label="عنوان اصلی صفحه اول" name="heroTitle" defaultValue={settings?.heroTitle} />
        <Field label="زیرعنوان صفحه اول" name="heroSubtitle" defaultValue={settings?.heroSubtitle} />
        <Field label="آدرس تصویر صفحه اول" name="heroImageUrl" defaultValue={settings?.heroImageUrl ?? ''} />
        <Field label="متن فوتر" name="footerText" defaultValue={settings?.footerText} textarea />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          ذخیره
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-slate-600">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <input
          id={name}
          name={name}
          defaultValue={defaultValue}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      )}
    </div>
  );
}
