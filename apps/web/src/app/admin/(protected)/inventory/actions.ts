'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin/session';
import { adjustStock } from '@/lib/admin/inventory';

export async function adjustStockAction(variantId: string, formData: FormData): Promise<void> {
  const { admin } = await requirePermission('inventory.manage');
  const delta = Number(formData.get('delta'));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!Number.isInteger(delta) || delta === 0) throw new Error('مقدار تغییر باید عددی صحیح و غیرصفر باشد.');

  await adjustStock(variantId, delta, reason, admin.id);
  revalidatePath('/admin/inventory');
}
