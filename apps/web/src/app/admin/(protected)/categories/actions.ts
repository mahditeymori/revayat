'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { categoryInput, createCategory, setCategoryActive, updateCategory } from '@/lib/admin/categories';

function parse(formData: FormData) {
  const imageUrl = String(formData.get('imageUrl') ?? '').trim();
  return categoryInput.parse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    imageUrl: imageUrl || null,
    sortOrder: formData.get('sortOrder') || 0,
  });
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requirePermission('categories.manage');
  await createCategory(parse(formData));
  redirect('/admin/categories');
}

export async function updateCategoryAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('categories.manage');
  await updateCategory(id, parse(formData));
  redirect('/admin/categories');
}

export async function toggleCategoryActiveAction(id: string, active: boolean): Promise<void> {
  await requirePermission('categories.manage');
  await setCategoryActive(id, active);
  redirect('/admin/categories');
}
