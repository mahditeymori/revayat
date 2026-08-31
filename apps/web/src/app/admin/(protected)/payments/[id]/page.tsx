export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { hasPermission } from '@/lib/admin/rbac';
import { getPayment, listPaymentsForOrder } from '@/lib/admin/payments';
import { inquiryPaymentAction } from '../actions';

const RIAL = new Intl.NumberFormat('fa-IR');
const DATE = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  succeeded: 'موفق',
  failed: 'ناموفق',
  canceled: 'لغوشده',
};

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('payments.view');
  const { id } = await params;
  const data = await getPayment(id);
  if (!data?.order) notFound();

  const attempts = await listPaymentsForOrder(data.order.id);
  const canInquire = hasPermission(session.admin.role, 'payments.inquiry');

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-medium text-slate-900">پرداخت‌های سفارش #{data.order.id}</h1>

      <ul className="space-y-3">
        {attempts.map((p) => (
          <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-900">{STATUS_LABELS[p.status] ?? p.status}</span>
              <span className="text-slate-500">{DATE.format(p.createdAt)}</span>
            </div>
            <p className="text-slate-600">مبلغ: {RIAL.format(p.amountRial)} ریال</p>
            {p.trackId && <p className="text-slate-500">کد پیگیری زیبال: {p.trackId}</p>}
            {p.gatewayRefNumber && <p className="text-slate-500">شماره ارجاع بانک: {p.gatewayRefNumber}</p>}
            {p.gatewayCardNumber && <p className="text-slate-500">شماره کارت: {p.gatewayCardNumber}</p>}
            {p.status === 'pending' && canInquire && (
              <form action={inquiryPaymentAction.bind(null, p.id)} className="mt-2">
                <button type="submit" className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  استعلام مجدد از درگاه
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
