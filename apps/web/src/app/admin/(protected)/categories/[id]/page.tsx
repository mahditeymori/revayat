export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getCategoryAdmin } from '@/lib/admin/categories';
import CategoryForm from '../CategoryForm';
import { updateCategoryAction } from '../actions';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('categories.manage');
  const { id } = await params;
  const category = await getCategoryAdmin(id);
  if (!category) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">ویرایش دسته‌بندی</h1>
      <CategoryForm action={updateCategoryAction.bind(null, id)} defaultValues={category} />
    </div>
  );
}
