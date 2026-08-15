import { notFound } from 'next/navigation';
import { getCatalog } from '@/lib/catalog';
import { ProductForm } from './ProductForm';

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
    </div>
  );
}
