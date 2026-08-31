export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { getCouponAdmin, getCouponUsageHistory, maskPhone } from '@/lib/admin/coupons';
import CouponForm from '../CouponForm';
import { updateCouponAction } from '../actions';

const RIAL = new Intl.NumberFormat('fa-IR');
const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
const USAGE_STATUS_LABELS: Record<string, string> = {
  reserved: 'در حال بررسی',
  confirmed: 'تایید شده',
  released: 'آزادشده',
};

function toDateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('coupons.manage');
  const { id } = await params;
  const coupon = await getCouponAdmin(id);
  if (!coupon) notFound();

  const usage = await getCouponUsageHistory(id);
  const confirmedCount = usage.filter((u) => u.status === 'reserved' || u.status === 'confirmed').length;
  const usageCap = coupon.maxUsesTotal != null ? `${confirmedCount} / ${coupon.maxUsesTotal}` : `${confirmedCount} / نامحدود`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">{coupon.code}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {coupon.assignedPhone ? `مختص شماره: ${maskPhone(coupon.assignedPhone)}` : 'برای همه مشتریان'} · وضعیت: {coupon.active ? 'فعال' : 'غیرفعال'} · مصرف: {usageCap}
        </p>
      </div>

      <CouponForm
        action={updateCouponAction.bind(null, id)}
        defaultValues={{
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          maxUsesTotal: coupon.maxUsesTotal,
          maxUsesPerCustomer: coupon.maxUsesPerCustomer,
          minSubtotalRial: coupon.minSubtotalRial,
          active: coupon.active,
          expiresAt: toDateInputValue(coupon.expiresAt),
          assignedPhone: coupon.assignedPhone ?? '',
        }}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <h2 className="mb-3 font-medium text-slate-900">تاریخچه استفاده</h2>
        <ul className="divide-y divide-slate-100">
          {usage.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>
                {u.maskedPhone} ·{' '}
                <Link href={`/admin/orders/${u.orderId}`} className="text-slate-900 hover:underline">
                  سفارش #{u.orderId}
                </Link>
              </span>
              <span className="text-slate-500">
                {USAGE_STATUS_LABELS[u.status] ?? u.status} · {RIAL.format(u.discountRial)} ریال · {DATE.format(u.createdAt)}
              </span>
            </li>
          ))}
          {usage.length === 0 && <li className="py-6 text-center text-slate-400">هنوز استفاده نشده است.</li>}
        </ul>
      </section>
    </div>
  );
}
