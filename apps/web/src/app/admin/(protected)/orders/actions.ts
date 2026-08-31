'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin/session';
import { updateOrderStatusAdmin } from '@/lib/admin/orders';
import type { OrderStatus } from '@/lib/commerce/types';

export async function updateOrderStatusAction(orderId: number, formData: FormData): Promise<void> {
  await requirePermission('orders.manage');
  const status = String(formData.get('status')) as OrderStatus;
  await updateOrderStatusAdmin(orderId, status);
  revalidatePath(`/admin/orders/${orderId}`);
}
