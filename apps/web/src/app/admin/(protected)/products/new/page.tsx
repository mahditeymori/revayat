export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import { listCategoriesAdmin } from '@/lib/admin/categories';
import ProductForm from '../ProductForm';
import { createProductAction } from '../actions';

export default async function NewProductPage() {
  await requirePermission('products.manage');
  const categories = await listCategoriesAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">محصول جدید</h1>
      <ProductForm action={createProductAction} categories={categories} />
    </div>
  );
}
