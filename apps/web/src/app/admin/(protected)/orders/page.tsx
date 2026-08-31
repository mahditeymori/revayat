export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listOrders } from '@/lib/admin/orders';

const RIAL = new Intl.NumberFormat('fa-IR');
const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  processing: 'در حال پردازش',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  canceled: 'لغوشده',
};

const PAYMENT_LABELS: Record<string, string> = { unpaid: 'پرداخت‌نشده', paid: 'پرداخت‌شده', failed: 'ناموفق' };

export default async function OrdersPage() {
  await requirePermission('orders.view');
  const orders = await listOrders({ limit: 100 });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">سفارش‌ها</h1>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">شماره</th>
            <th className="px-4 py-2 text-right">مشتری</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
            <th className="px-4 py-2 text-right">پرداخت</th>
            <th className="px-4 py-2 text-right">مبلغ</th>
            <th className="px-4 py-2 text-right">تاریخ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/orders/${order.id}`} className="text-slate-900 hover:underline">
                  #{order.id}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-500">{order.shipping.name}</td>
              <td className="px-4 py-2">{STATUS_LABELS[order.status]}</td>
              <td className="px-4 py-2">{PAYMENT_LABELS[order.paymentStatus]}</td>
              <td className="px-4 py-2">{RIAL.format(order.total.amount)} ریال</td>
              <td className="px-4 py-2 text-slate-500">{DATE.format(order.createdAt)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                سفارشی ثبت نشده است.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
