import { getCatalog } from '@/lib/catalog';
import { ProductForm } from '../[id]/ProductForm';

export default async function AdminProductNewPage() {
  const { categories } = await getCatalog();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">محصول جدید</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
