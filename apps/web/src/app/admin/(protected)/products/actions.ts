'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { uploadMediaFile } from '@/lib/admin/media';
import {
  addProductImages,
  createProduct,
  deleteProductImage,
  productInput,
  reorderProductImages,
  setProductActive,
  updateProduct,
} from '@/lib/admin/products';

function parseProduct(formData: FormData) {
  const salePriceRial = String(formData.get('salePriceRial') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '').trim();
  const variants = JSON.parse(String(formData.get('variantsJson') ?? '[]'));

  return productInput.parse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    subtitle: formData.get('subtitle') ?? '',
    description: formData.get('description') ?? '',
    priceRial: formData.get('priceRial'),
    salePriceRial: salePriceRial || null,
    categoryId: categoryId || null,
    featured: formData.get('featured') === 'on',
    active: formData.get('active') === 'on',
    variants,
  });
}

export async function createProductAction(formData: FormData): Promise<void> {
  await requirePermission('products.manage');
  const product = await createProduct(parseProduct(formData));
  redirect(`/admin/products/${product.id}`);
}

export async function updateProductAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('products.manage');
  await updateProduct(id, parseProduct(formData));
  redirect(`/admin/products/${id}`);
}

export async function toggleProductActiveAction(id: string, active: boolean): Promise<void> {
  await requirePermission('products.manage');
  await setProductActive(id, active);
  redirect('/admin/products');
}

export async function uploadProductImageAction(productId: string, formData: FormData): Promise<void> {
  await requirePermission('products.manage');
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    const asset = await uploadMediaFile(file);
    await addProductImages(productId, [{ url: asset.url, altText: String(formData.get('altText') ?? '') }]);
  }
  redirect(`/admin/products/${productId}`);
}

export async function deleteProductImageAction(productId: string, imageId: string): Promise<void> {
  await requirePermission('products.manage');
  await deleteProductImage(imageId);
  redirect(`/admin/products/${productId}`);
}

export async function reorderProductImagesAction(productId: string, imageIds: string[]): Promise<void> {
  await requirePermission('products.manage');
  await reorderProductImages(imageIds);
  redirect(`/admin/products/${productId}`);
}
