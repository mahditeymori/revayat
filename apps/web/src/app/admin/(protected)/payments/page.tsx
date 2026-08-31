export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listPayments } from '@/lib/admin/payments';

const RIAL = new Intl.NumberFormat('fa-IR');
const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  succeeded: 'موفق',
  failed: 'ناموفق',
  canceled: 'لغوشده',
};

export default async function PaymentsPage() {
  await requirePermission('payments.view');
  const payments = await listPayments();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">پرداخت‌ها</h1>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">سفارش</th>
            <th className="px-4 py-2 text-right">مبلغ</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
            <th className="px-4 py-2 text-right">شماره پیگیری</th>
            <th className="px-4 py-2 text-right">تاریخ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/payments/${p.id}`} className="text-slate-900 hover:underline">
                  سفارش #{p.orderId}
                </Link>
              </td>
              <td className="px-4 py-2">{RIAL.format(p.amountRial)} ریال</td>
              <td className="px-4 py-2">{STATUS_LABELS[p.status] ?? p.status}</td>
              <td className="px-4 py-2 text-slate-500">{p.gatewayRefNumber ?? '-'}</td>
              <td className="px-4 py-2 text-slate-500">{DATE.format(p.createdAt)}</td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                پرداختی ثبت نشده است.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
