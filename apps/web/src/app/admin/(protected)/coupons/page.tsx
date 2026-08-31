export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listCouponsAdmin, maskPhone } from '@/lib/admin/coupons';
import { toggleCouponActiveAction } from './actions';

const RIAL = new Intl.NumberFormat('fa-IR');
const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' });
const TYPE_LABELS: Record<string, string> = { percentage: 'درصدی', fixed: 'مبلغ ثابت' };

export default async function CouponsPage() {
  await requirePermission('coupons.view');
  const coupons = await listCouponsAdmin();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">کدهای تخفیف</h1>
        <Link href="/admin/coupons/new" className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">
          کد تخفیف جدید
        </Link>
      </div>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">کد</th>
            <th className="px-4 py-2 text-right">نوع / مقدار</th>
            <th className="px-4 py-2 text-right">مختص شماره</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
            <th className="px-4 py-2 text-right">انقضا</th>
            <th className="px-4 py-2 text-right">عملیات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {coupons.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/coupons/${c.id}`} className="font-medium text-slate-900 hover:underline">
                  {c.code}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-600">
                {TYPE_LABELS[c.type]} · {c.type === 'percentage' ? `${c.value}%` : `${RIAL.format(c.value)} ریال`}
              </td>
              <td className="px-4 py-2 text-slate-500">{c.assignedPhone ? maskPhone(c.assignedPhone) : 'آزاد'}</td>
              <td className="px-4 py-2">
                <span className={c.active ? 'text-emerald-600' : 'text-slate-400'}>{c.active ? 'فعال' : 'غیرفعال'}</span>
              </td>
              <td className="px-4 py-2 text-slate-500">{c.expiresAt ? DATE.format(c.expiresAt) : '-'}</td>
              <td className="px-4 py-2">
                <form action={toggleCouponActiveAction.bind(null, c.id, !c.active)}>
                  <button type="submit" className="text-xs text-slate-600 hover:underline">
                    {c.active ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {coupons.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                کد تخفیفی ثبت نشده است.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
