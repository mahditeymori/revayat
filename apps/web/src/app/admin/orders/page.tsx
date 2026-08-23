import Image from 'next/image';
import Link from 'next/link';
import { listOrders, orderPaymentState, type OrderStatus, type PaymentState } from '@/lib/catalog';
import { formatToman, formatJalali, toPersianDigits } from '@/lib/format';
import { updateOrderStatusAction } from '../actions';
import { DeleteOrderForm } from './DeleteOrderForm';
import { requireAdminPage } from '@/lib/admin';

const STATUS_FA: Record<OrderStatus, string> = {
  new: 'جدید',
  processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  done: 'تحویل شده',
  canceled: 'لغو شده',
};

// Fulfilment status and payment state are separate axes: an order can be paid
// but not yet shipped, or shipped after an offline payment. Both are shown.
const PAYMENT_FA: Record<PaymentState, string> = {
  paid: 'پرداخت شده',
  awaiting: 'در انتظار پرداخت',
  failed: 'پرداخت ناموفق',
  unpaid: 'پرداخت نشده',
};

const PAYMENT_CLASS: Record<PaymentState, string> = {
  paid: 'border-ink bg-ink text-cream',
  awaiting: 'border-sand text-sand-dark',
  failed: 'border-clay text-clay',
  unpaid: 'border-cream-200 text-ink-60',
};

export default async function AdminOrdersPage() {
  // Layouts do not gate the pages beneath them — see requireAdminPage.
  await requireAdminPage();

  const orders = (await listOrders()).slice().reverse();

  return (
    <div>
      <h1 className="text-xl font-medium">سفارش‌ها</h1>
      {orders.length === 0 ? (
        <p className="mt-10 text-sm text-ink-60">هنوز سفارشی ثبت نشده است.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {orders.map((o) => (
            <li key={o.id} className="border border-cream-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium">
                      سفارش {toPersianDigits(o.id)} — {formatToman(o.totalRial)}
                    </p>
                    <span className={`border px-3 py-1 text-xs ${PAYMENT_CLASS[orderPaymentState(o)]}`}>
                      {PAYMENT_FA[orderPaymentState(o)]}
                    </span>
                    {o.paidTrackId && (
                      <Link
                        href={`/admin/payments?q=${o.paidTrackId}`}
                        className="text-xs text-ink-60 underline hover:text-ink"
                        dir="ltr"
                      >
                        {toPersianDigits(o.paidTrackId)}
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-60">{formatJalali(o.createdAt)}</p>
                  <p className="mt-3 text-sm">
                    {o.customer.name} — <span dir="ltr">{toPersianDigits(o.customer.phone)}</span>
                  </p>
                  <p className="mt-1 text-xs leading-6 text-ink-60">
                    {o.customer.state}، {o.customer.city}، {o.customer.address}
                    {o.customer.postcode && ` — کد پستی ${toPersianDigits(o.customer.postcode)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={updateOrderStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={o.id} />
                    <select
                      name="status"
                      defaultValue={o.status}
                      className="border border-cream-200 bg-transparent px-3 py-2 text-xs"
                    >
                      {(Object.keys(STATUS_FA) as OrderStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_FA[s]}</option>
                      ))}
                    </select>
                    <button type="submit" className="bg-ink px-4 py-2 text-xs text-cream hover:bg-sand-dark">
                      ثبت
                    </button>
                  </form>
                  <DeleteOrderForm orderId={o.id} />
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-4 border-t border-cream-200 pt-4">
                {o.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-xs">
                    {item.image && (
                      <div className="relative h-14 w-10 overflow-hidden bg-cream-200">
                        <Image src={item.image} alt="" fill sizes="40px" className="object-cover" />
                      </div>
                    )}
                    <div>
                      <p>{item.name}</p>
                      <p className="mt-1 text-ink-60">
                        {item.size}
                        {item.color && ` / ${item.color}`} × {toPersianDigits(item.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
