export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/admin/session';
import { getDashboardStats } from '@/lib/admin/dashboard';

const RIAL = new Intl.NumberFormat('fa-IR');

const CARDS: { key: keyof Awaited<ReturnType<typeof getDashboardStats>>; label: string }[] = [
  { key: 'totalProducts', label: 'کل محصولات' },
  { key: 'activeProducts', label: 'محصولات فعال' },
  { key: 'lowStockVariants', label: 'تنوع‌های کم‌موجود' },
  { key: 'pendingOrders', label: 'سفارش‌های در انتظار' },
  { key: 'paidOrders', label: 'سفارش‌های پرداخت‌شده' },
  { key: 'pendingPayments', label: 'پرداخت‌های در انتظار' },
  { key: 'failedPayments', label: 'پرداخت‌های ناموفق' },
  { key: 'confirmedCouponUsages', label: 'استفاده از کد تخفیف' },
];

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-medium text-slate-900">
              {RIAL.format(stats[card.key] as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-900">سفارش‌های اخیر</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {stats.recentOrders.map((order) => (
              <li key={order.id} className="flex justify-between py-2">
                <span className="text-slate-600">#{order.id} · {order.status} / {order.paymentStatus}</span>
                <span className="text-slate-900">{RIAL.format(order.totalRial)} ریال</span>
              </li>
            ))}
            {stats.recentOrders.length === 0 && <li className="py-2 text-slate-400">سفارشی ثبت نشده است.</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-900">پرداخت‌های اخیر</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {stats.recentPayments.map((payment) => (
              <li key={payment.id} className="flex justify-between py-2">
                <span className="text-slate-600">سفارش #{payment.orderId} · {payment.status}</span>
                <span className="text-slate-900">{RIAL.format(payment.amountRial)} ریال</span>
              </li>
            ))}
            {stats.recentPayments.length === 0 && <li className="py-2 text-slate-400">پرداختی ثبت نشده است.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
