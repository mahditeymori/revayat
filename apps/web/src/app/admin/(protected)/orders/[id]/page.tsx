export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getOrder } from '@/lib/admin/orders';
import type { OrderStatus } from '@/lib/commerce/types';
import { updateOrderStatusAction } from '../actions';

const RIAL = new Intl.NumberFormat('fa-IR');

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'در انتظار',
  processing: 'در حال پردازش',
  shipped: 'ارسال‌شده',
  completed: 'تکمیل‌شده',
  canceled: 'لغوشده',
};

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'canceled'],
  processing: ['shipped', 'canceled'],
  shipped: ['completed'],
  completed: [],
  canceled: [],
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('orders.view');
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  const canManage = session.admin.role !== 'editor';
  const nextOptions = NEXT_STATUSES[order.status];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-medium text-slate-900">سفارش #{order.id}</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <p className="mb-1 text-slate-900">{order.shipping.name} · {order.shipping.phone}</p>
        <p className="text-slate-500">{order.shipping.address} — {order.shipping.postalCode}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <h2 className="mb-3 font-medium text-slate-900">اقلام سفارش</h2>
        <ul className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2">
              <span>{item.productName} {item.variantTitle && `(${item.variantTitle})`} × {item.quantity}</span>
              <span>{RIAL.format(item.unitPrice.amount * item.quantity)} ریال</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-slate-600">
          <p className="flex justify-between"><span>جمع جزء</span><span>{RIAL.format(order.subtotal.amount)} ریال</span></p>
          <p className="flex justify-between"><span>تخفیف</span><span>{RIAL.format(order.discount.amount)} ریال</span></p>
          <p className="flex justify-between font-medium text-slate-900"><span>مبلغ کل</span><span>{RIAL.format(order.total.amount)} ریال</span></p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <h2 className="mb-3 font-medium text-slate-900">وضعیت سفارش</h2>
        <p className="mb-3">وضعیت فعلی: <strong>{STATUS_LABELS[order.status]}</strong></p>
        {canManage && nextOptions.length > 0 && (
          <div className="flex gap-2">
            {nextOptions.map((status) => (
              <form key={status} action={updateOrderStatusAction.bind(null, order.id)}>
                <input type="hidden" name="status" value={status} />
                <button type="submit" className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  انتقال به «{STATUS_LABELS[status]}»
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
