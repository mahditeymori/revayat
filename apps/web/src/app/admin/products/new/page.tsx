import { getCatalog } from '@/lib/catalog';
import { ProductForm } from '../[id]/ProductForm';
import { requireAdminPage } from '@/lib/admin';

export default async function AdminProductNewPage() {
  // Layouts do not gate the pages beneath them — see requireAdminPage.
  await requireAdminPage();

  const { categories } = await getCatalog();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">محصول جدید</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
