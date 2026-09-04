export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getCategoryAdmin } from '@/lib/admin/categories';
import CategoryForm from '../CategoryForm';
import { updateCategoryAction, uploadCategoryImageAction } from '../actions';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('categories.manage');
  const { id } = await params;
  const category = await getCategoryAdmin(id);
  if (!category) notFound();

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-medium text-slate-900">ویرایش دسته‌بندی</h1>
      <CategoryForm action={updateCategoryAction.bind(null, id)} defaultValues={category} />

      <section className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-medium text-slate-900">تصویر دسته‌بندی</h2>
        {category.imageUrl && (
          <img
            src={category.imageUrl}
            alt=""
            className="mb-4 aspect-video w-full rounded border border-slate-200 object-cover"
          />
        )}
        <form action={uploadCategoryImageAction.bind(null, id)} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">فایل تصویر</label>
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            آپلود
          </button>
        </form>
      </section>
    </div>
  );
}
