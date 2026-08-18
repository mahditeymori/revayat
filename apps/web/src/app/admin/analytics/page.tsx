import Link from 'next/link';
import { buildDashboard } from '@/lib/reports';
import { formatToman, toPersianDigits } from '@/lib/format';
import { DayColumns, RankedList, Stat } from '@/components/charts';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;
const pct = (n: number) => `${toPersianDigits((n * 100).toFixed(1))}٪`;
const num = (n: number) => toPersianDigits(n.toLocaleString('en-US')).replace(/,/g, '٬');

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: raw } = await searchParams;
  const days = RANGES.find((r) => String(r) === raw) ?? 30;
  const { traffic, products, sales } = await buildDashboard(days);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-medium">آمار سایت</h1>
        <nav aria-label="بازه زمانی" className="flex gap-2 text-xs">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?days=${r}`}
              aria-current={r === days ? 'page' : undefined}
              className={
                r === days
                  ? 'bg-ink px-3 py-2 text-cream'
                  : 'border border-cream-200 px-3 py-2 hover:border-ink'
              }
            >
              {toPersianDigits(r)} روز
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-2 text-xs text-ink-60">
        آمار روی سرور خودمان و بدون سرویس بیرونی ثبت می‌شود. شناسایی با دو کوکی داخلی انجام
        می‌شود: نشست ۳۰ دقیقه و بازدیدکننده ۱۸۰ روز — هر دو فقط یک شناسه تصادفی، بدون هیچ
        اطلاعات شخصی. بازدیدکننده‌ای که کوکی را مسدود کند همیشه «جدید» شمرده می‌شود، پس عدد
        بازگشتی کمی کمتر از واقعیت است. بازدید از پنل مدیریت ثبت نمی‌شود.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="بازدید صفحه" value={num(traffic.pageviews)} />
        <Stat label="بازدیدکننده یکتا" value={num(traffic.visitors)} />
        <Stat
          label="نشست"
          value={num(traffic.sessions)}
          note={`${num(traffic.returning)} بازدیدکننده بازگشتی`}
        />
        <Stat
          label="درآمد"
          value={formatToman(sales.revenueRial, { suffix: false })}
          note="تومان — بدون سفارش‌های لغوشده"
        />
        <Stat
          label="سفارش"
          value={num(sales.orders)}
          note={sales.orders ? `میانگین ${formatToman(sales.averageRial)}` : undefined}
        />
        <Stat label="افزودن به سبد" value={num(products.addToCart)} />
        <Stat
          label="بازدید محصول ← سبد"
          value={pct(products.viewToCartRate)}
          note="چند درصد بازدیدها به سبد رسید"
        />
        <Stat
          label="سبد ← سفارش"
          value={pct(products.cartToOrderRate)}
          note="چند درصد سبدها به سفارش رسید"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DayColumns data={traffic.byDay} title="بازدید صفحه در روز" unit="تعداد بازدید" />
        <DayColumns
          data={sales.byDay}
          title="درآمد در روز"
          unit="هزار تومان"
          scale={10_000 /* Rial → thousand Toman */}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankedList title="پربازدیدترین صفحه‌ها" rows={traffic.topPages} ltr />
        <RankedList
          title="منبع ورود"
          rows={traffic.topReferrers}
          ltr
          empty="ورودی مستقیم — هنوز ارجاعی از سایت دیگری ثبت نشده است."
        />
        <RankedList title="پربازدیدترین محصول‌ها" rows={products.topViewed} />
        <RankedList title="پرفروش‌ترین محصول‌ها" rows={sales.topSellers} format={(n) => `${num(n)} عدد`} />
        <RankedList title="جستجوهای کاربران" rows={products.topSearched} />
        <RankedList title="وضعیت سفارش‌ها" rows={sales.byStatus.map(faStatus)} />
      </div>
    </div>
  );
}

const STATUS_FA: Record<string, string> = {
  new: 'جدید',
  processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  done: 'تحویل شده',
  canceled: 'لغو شده',
};

const faStatus = (r: { label: string; count: number }) => ({
  ...r,
  label: STATUS_FA[r.label] ?? r.label,
});
