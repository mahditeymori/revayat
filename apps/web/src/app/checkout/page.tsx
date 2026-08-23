import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCart } from '@/lib/cart';
import { formatToman } from '@/lib/format';
import { submitCheckoutAction } from '@/app/cart/actions';
import { isConfigured } from '@/lib/zibal';

export const metadata: Metadata = { title: 'ثبت سفارش', robots: { index: false } };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  name: 'نام و نام خانوادگی را درست وارد کنید.',
  phone: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
  email: 'ایمیل واردشده معتبر نیست.',
  address: 'استان، شهر و نشانی را کامل وارد کنید.',
  postcode: 'کد پستی باید ۱۰ رقم باشد.',
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, cart] = await Promise.all([searchParams, getCart()]);
  if (cart.items.length === 0) redirect('/cart');

  // Server-side only — isConfigured reads a non-public env var and this is a
  // server component, so the merchant id never reaches the browser.
  const gatewayReady = isConfigured();

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">ثبت سفارش</h1>
      <p className="mt-3 text-sm text-ink-60">
        پس از ثبت اطلاعات، به درگاه بانکی امن زیبال منتقل می‌شوید و پرداخت را همان‌جا انجام می‌دهید.
      </p>

      {!gatewayReady && (
        <p role="alert" className="mt-6 border border-clay bg-clay/10 px-4 py-3 text-sm leading-7 text-clay">
          پرداخت آنلاین در حال حاضر در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.
        </p>
      )}

      {error && ERRORS[error] && (
        <p role="alert" className="mt-6 border border-clay bg-clay/10 px-4 py-3 text-sm text-clay">
          {ERRORS[error]}
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form action={submitCheckoutAction} className="grid gap-5 sm:grid-cols-2">
          <Field name="name" label="نام و نام خانوادگی" required autoComplete="name" />
          <Field name="phone" label="شماره موبایل" required type="tel" dir="ltr" autoComplete="tel" placeholder="09xxxxxxxxx" />
          <Field name="email" label="ایمیل (اختیاری)" type="email" dir="ltr" autoComplete="email" />
          <Field name="state" label="استان" required autoComplete="address-level1" />
          <Field name="city" label="شهر" required autoComplete="address-level2" />
          <Field name="postcode" label="کد پستی (اختیاری)" dir="ltr" autoComplete="postal-code" />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-xs text-ink-60" htmlFor="address">نشانی کامل *</label>
            <textarea
              id="address"
              name="address"
              required
              rows={3}
              autoComplete="street-address"
              className="w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!gatewayReady}
            className="bg-ink py-4 text-sm text-cream transition-colors hover:bg-sand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            پرداخت و ثبت نهایی سفارش
          </button>
        </form>

        <aside className="h-max border border-cream-200 p-6 lg:sticky lg:top-24">
          <h2 className="text-sm font-medium">سفارش شما</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {cart.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3">
                <span className="text-ink-60">
                  {i.product.name} ({i.size}) × {i.quantity}
                </span>
                <span>{formatToman(i.lineTotalRial)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-cream-200 pt-4 text-base font-medium">
            <span>جمع کل</span>
            <span>{formatToman(cart.totalRial)}</span>
          </div>
          <p className="mt-3 text-xs leading-6 text-ink-60">
            همین مبلغ در درگاه بانکی از شما دریافت می‌شود.
          </p>
          <Link href="/cart" className="mt-4 block text-center text-xs text-ink-60 underline hover:text-ink">
            بازگشت به سبد خرید
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  type = 'text',
  dir,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  dir?: 'ltr' | 'rtl';
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs text-ink-60" htmlFor={name}>
        {label} {required && '*'}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        dir={dir}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none"
      />
    </div>
  );
}
