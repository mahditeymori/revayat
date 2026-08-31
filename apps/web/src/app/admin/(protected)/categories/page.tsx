export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listCategoriesAdmin } from '@/lib/admin/categories';
import { toggleCategoryActiveAction } from './actions';

export default async function CategoriesPage() {
  await requirePermission('categories.manage');
  const categories = await listCategoriesAdmin();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">دسته‌بندی‌ها</h1>
        <Link href="/admin/categories/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          دسته‌بندی جدید
        </Link>
      </div>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">نام</th>
            <th className="px-4 py-2 text-right">اسلاگ</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
            <th className="px-4 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((category) => (
            <tr key={category.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/categories/${category.id}`} className="text-slate-900 hover:underline">
                  {category.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-500">{category.slug}</td>
              <td className="px-4 py-2">
                <span className={category.active ? 'text-emerald-600' : 'text-slate-400'}>
                  {category.active ? 'فعال' : 'غیرفعال'}
                </span>
              </td>
              <td className="px-4 py-2 text-left">
                <form action={toggleCategoryActiveAction.bind(null, category.id, !category.active)}>
                  <button type="submit" className="text-slate-500 hover:text-slate-900">
                    {category.active ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                هنوز دسته‌بندی‌ای ثبت نشده است.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
