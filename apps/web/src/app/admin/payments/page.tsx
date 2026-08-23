// Payment management: every attempt, successful or not, with the trackId and
// bank details needed to reconcile against the Zibal dashboard.
import Link from 'next/link';
import { listPayments, totals, type Payment, type PaymentStatus } from '@/lib/payments';
import { listOrders } from '@/lib/catalog';
import { statusMessage, isSandbox, isConfigured, isConfigResult } from '@/lib/zibal';
import { formatToman, formatJalali, toPersianDigits } from '@/lib/format';
import { InquiryButton } from './InquiryButton';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const STATUS_FA: Record<PaymentStatus, string> = {
  paid: 'موفق',
  pending: 'در انتظار',
  failed: 'ناموفق',
  canceled: 'لغو شده',
};

const STATUS_CLASS: Record<PaymentStatus, string> = {
  paid: 'border-ink bg-ink text-cream',
  pending: 'border-sand text-sand-dark',
  failed: 'border-clay text-clay',
  canceled: 'border-cream-200 text-ink-60',
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'paid', label: 'موفق' },
  { key: 'pending', label: 'در انتظار' },
  { key: 'failed', label: 'ناموفق' },
  { key: 'canceled', label: 'لغو شده' },
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; notice?: string }>;
}) {
  // Layouts do not gate the pages beneath them — see requireAdminPage.
  await requireAdminPage();

  const [{ status, q, notice }, all, orders] = await Promise.all([
    searchParams,
    listPayments(),
    listOrders(),
  ]);

  const sums = totals(all);
  const active = FILTERS.some((f) => f.key === status) ? status! : 'all';
  const needle = (q ?? '').trim();

  const customerOf = new Map(orders.map((o) => [o.id, o.customer.name]));

  // Most recent configuration-class failure, if any — see isConfigResult.
  const configFault = all
    .slice()
    .reverse()
    .find((p) => isConfigResult(p.resultCode))?.errorMessage ?? null;

  let rows = all.slice().reverse();
  if (active !== 'all') rows = rows.filter((p) => p.status === active);
  if (needle) {
    rows = rows.filter(
      (p) =>
        p.trackId.includes(needle) ||
        String(p.orderId) === needle ||
        (p.transactionId ?? '').includes(needle),
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-medium">پرداخت‌ها</h1>
        <p className="text-xs text-ink-60">درگاه: زیبال</p>
      </div>

      {!isConfigured() && (
        <p role="alert" className="mt-4 border border-clay bg-clay/10 px-4 py-3 text-xs leading-6 text-clay">
          متغیر ZIBAL_MERCHANT تنظیم نشده است — پرداخت آنلاین در حال حاضر کار نمی‌کند.
        </p>
      )}
      {isSandbox() && (
        <p className="mt-4 border border-sand bg-sand/10 px-4 py-3 text-xs leading-6 text-sand-dark">
          حالت آزمایشی فعال است (merchant = zibal). هیچ پول واقعی جابه‌جا نمی‌شود.
        </p>
      )}
      {configFault && (
        <p role="alert" className="mt-4 border border-clay bg-clay/10 px-4 py-3 text-xs leading-6 text-clay">
          خطای پیکربندی درگاه: {configFault}
          {' '}این خطا همه‌ی پرداخت‌ها را متوقف می‌کند تا زمانی که در پنل زیبال یا تنظیمات سرور برطرف شود.
          {' '}اگر کد ۱۱۵ است، IP سرور را در پنل زیبال مجاز کنید.
        </p>
      )}
      {notice && (
        <p className="mt-4 border border-cream-200 px-4 py-3 text-xs leading-6 text-ink-60">
          {notice.slice(0, 300)}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="همه" value={toPersianDigits(sums.all)} />
        <Stat label="موفق" value={toPersianDigits(sums.paid)} />
        <Stat label="در انتظار" value={toPersianDigits(sums.pending)} />
        <Stat label="ناموفق" value={toPersianDigits(sums.failed + sums.canceled)} />
        <Stat label="جمع دریافتی" value={formatToman(sums.paidRial)} />
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/payments?status=${f.key}${needle ? `&q=${encodeURIComponent(needle)}` : ''}`}
            className={`border px-4 py-2 text-xs ${
              active === f.key ? 'border-ink bg-ink text-cream' : 'border-cream-200 hover:border-ink'
            }`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ms-auto flex items-center gap-2">
          <input type="hidden" name="status" value={active} />
          <input
            name="q"
            defaultValue={needle}
            dir="ltr"
            placeholder="شناسه پیگیری / سفارش"
            className="border border-cream-200 bg-transparent px-3 py-2 text-xs focus:border-ink focus:outline-none"
          />
          <button type="submit" className="border border-cream-200 px-4 py-2 text-xs hover:border-ink">
            جستجو
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-60">پرداختی با این فیلتر پیدا نشد.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((p) => (
            <PaymentRow key={p.id} payment={p} customer={customerOf.get(p.orderId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentRow({ payment: p, customer }: { payment: Payment; customer?: string }) {
  return (
    <li className="border border-cream-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`border px-3 py-1 text-xs ${STATUS_CLASS[p.status]}`}>
              {STATUS_FA[p.status]}
            </span>
            <p className="text-sm font-medium">{formatToman(p.amountRial)}</p>
            <p className="text-xs text-ink-60">
              سفارش {toPersianDigits(p.orderId)}
              {customer && ` — ${customer}`}
            </p>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
            <Detail label="شناسه پیگیری" value={toPersianDigits(p.trackId)} />
            <Detail label="شماره مرجع" value={p.transactionId ? toPersianDigits(p.transactionId) : '—'} />
            <Detail label="شماره کارت" value={p.cardNumber ? toPersianDigits(p.cardNumber) : '—'} />
            <Detail label="تاریخ پرداخت" value={p.paymentDate ? formatJalali(p.paymentDate) : '—'} />
            <Detail label="ایجاد" value={formatJalali(p.createdAt)} />
            <Detail
              label="وضعیت درگاه"
              value={p.statusCode != null ? `${toPersianDigits(p.statusCode)} — ${statusMessage(p.statusCode)}` : '—'}
            />
          </dl>
          {p.errorMessage && (
            <p className="mt-3 border-s-2 border-clay ps-3 text-xs leading-6 text-clay">
              {p.errorMessage}
            </p>
          )}
        </div>
        <InquiryButton trackId={p.trackId} />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cream-200 p-4">
      <dt className="text-xs text-ink-60">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-60">{label}:</dt>
      <dd dir="ltr" className="truncate">{value}</dd>
    </div>
  );
}
