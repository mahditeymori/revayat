export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import CouponForm from '../CouponForm';
import { createCouponAction } from '../actions';

export default async function NewCouponPage() {
  await requirePermission('coupons.manage');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">کد تخفیف جدید</h1>
      <CouponForm action={createCouponAction} />
    </div>
  );
}
