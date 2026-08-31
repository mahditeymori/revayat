'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { couponInput, createCoupon, setCouponActive, updateCoupon } from '@/lib/admin/coupons';

function parse(formData: FormData) {
  const maxUsesTotal = String(formData.get('maxUsesTotal') ?? '').trim();
  const expiresAt = String(formData.get('expiresAt') ?? '').trim();
  const assignedPhone = String(formData.get('assignedPhone') ?? '').trim();

  return couponInput.parse({
    code: formData.get('code'),
    type: formData.get('type'),
    value: formData.get('value'),
    maxUsesTotal: maxUsesTotal || null,
    maxUsesPerCustomer: formData.get('maxUsesPerCustomer') || 1,
    minSubtotalRial: formData.get('minSubtotalRial') || 0,
    active: formData.get('active') === 'on',
    expiresAt,
    assignedPhone,
  });
}

export async function createCouponAction(formData: FormData): Promise<void> {
  await requirePermission('coupons.manage');
  await createCoupon(parse(formData));
  redirect('/admin/coupons');
}

export async function updateCouponAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('coupons.manage');
  await updateCoupon(id, parse(formData));
  redirect('/admin/coupons');
}

export async function toggleCouponActiveAction(id: string, active: boolean): Promise<void> {
  await requirePermission('coupons.manage');
  await setCouponActive(id, active);
  redirect('/admin/coupons');
}
