export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import CategoryForm from '../CategoryForm';
import { createCategoryAction } from '../actions';

export default async function NewCategoryPage() {
  await requirePermission('categories.manage');
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">دسته‌بندی جدید</h1>
      <CategoryForm action={createCategoryAction} />
    </div>
  );
}
