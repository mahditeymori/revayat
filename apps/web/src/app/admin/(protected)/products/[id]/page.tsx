export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getProductAdmin } from '@/lib/admin/products';
import { listCategoriesAdmin } from '@/lib/admin/categories';
import ProductForm from '../ProductForm';
import {
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductAction,
  uploadProductImageAction,
} from '../actions';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('products.manage');
  const { id } = await params;
  const [data, categories] = await Promise.all([getProductAdmin(id), listCategoriesAdmin()]);
  if (!data) notFound();
  const { product, variants, images } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-medium text-slate-900">ویرایش محصول</h1>
      <ProductForm
        action={updateProductAction.bind(null, id)}
        categories={categories}
        defaultValues={{ ...product, variants }}
      />

      <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-medium text-slate-900">تصاویر محصول</h2>

        <form action={uploadProductImageAction.bind(null, id)} className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">فایل تصویر</label>
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">متن جایگزین</label>
            <input name="altText" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            آپلود
          </button>
        </form>

        <div className="grid grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="space-y-1">
              <img src={img.url} alt={img.altText} className="aspect-square w-full rounded border border-slate-200 object-cover" />
              <div className="flex justify-between text-xs text-slate-500">
                <form action={reorderProductImagesAction.bind(null, id, moveUp(images, i))}>
                  <button type="submit" disabled={i === 0} className="disabled:opacity-30">
                    بالا
                  </button>
                </form>
                <form action={deleteProductImageAction.bind(null, id, img.id)}>
                  <button type="submit" className="text-red-600 hover:underline">
                    حذف
                  </button>
                </form>
              </div>
            </div>
          ))}
          {images.length === 0 && <p className="col-span-4 text-sm text-slate-400">تصویری ثبت نشده است.</p>}
        </div>
      </section>
    </div>
  );
}

function moveUp(images: { id: string }[], index: number): string[] {
  const ids = images.map((img) => img.id);
  if (index === 0) return ids;
  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
  return ids;
}
