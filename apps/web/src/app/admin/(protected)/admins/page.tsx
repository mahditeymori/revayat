export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import { listAdmins } from '@/lib/admin/admins';
import { createAdminAction, toggleAdminActiveAction } from './actions';

const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' });
const ROLE_LABELS: Record<string, string> = { owner: 'مالک', admin: 'مدیر', editor: 'ویرایشگر', support: 'پشتیبانی' };

export default async function AdminsPage() {
  await requirePermission('admins.manage');
  const admins = await listAdmins();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-lg font-medium text-slate-900">مدیران</h1>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">ایمیل</th>
            <th className="px-4 py-2 text-right">نقش</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
            <th className="px-4 py-2 text-right">تاریخ ایجاد</th>
            <th className="px-4 py-2 text-right">عملیات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {admins.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2 text-slate-900">{a.email}</td>
              <td className="px-4 py-2 text-slate-600">{ROLE_LABELS[a.role]}</td>
              <td className="px-4 py-2">
                <span className={a.active ? 'text-emerald-600' : 'text-slate-400'}>{a.active ? 'فعال' : 'غیرفعال'}</span>
              </td>
              <td className="px-4 py-2 text-slate-500">{DATE.format(a.createdAt)}</td>
              <td className="px-4 py-2">
                <form action={toggleAdminActiveAction.bind(null, a.id, !a.active)}>
                  <button type="submit" className="text-xs text-slate-600 hover:underline">
                    {a.active ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={createAdminAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <p className="font-medium text-slate-900">افزودن مدیر جدید</p>
        <div>
          <label htmlFor="email" className="mb-1 block text-slate-600">
            ایمیل
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-slate-600">
            رمز عبور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="role" className="mb-1 block text-slate-600">
            نقش
          </label>
          <select
            id="role"
            name="role"
            defaultValue="editor"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="owner">مالک</option>
            <option value="admin">مدیر</option>
            <option value="editor">ویرایشگر</option>
            <option value="support">پشتیبانی</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          افزودن
        </button>
      </form>
    </div>
  );
}
