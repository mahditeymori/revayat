import { notFound } from 'next/navigation';
import { getCatalog } from '@/lib/catalog';
import { deleteProductAction } from '@/app/admin/actions';
import { ProductForm } from './ProductForm';
import { DeleteButton } from './DeleteButton';

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.id === Number(id));
  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">ویرایش: {product.name}</h1>
      <ProductForm product={product} categories={catalog.categories} />

      <form action={deleteProductAction} className="mt-12 border-t border-cream-200 pt-6">
        <input type="hidden" name="id" value={product.id} />
        <DeleteButton />
      </form>
    </div>
  );
}
