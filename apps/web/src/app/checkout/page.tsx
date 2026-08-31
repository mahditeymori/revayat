// Server component: reads the cart straight from the DB via the cartToken
// cookie (not the client CartProvider context) — checkout is a one-shot page
// load, not something that needs to stay optimistically in sync with drawer
// edits happening elsewhere, and rendering server-side means the order
// summary can never disagree with what createOrder is about to charge.
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCart } from '@/lib/commerce/cart';
import { isConfigured } from '@/lib/zibal/client';
import { formatToman } from '@/lib/format';
import { submitCheckoutAction } from './actions';

const ERRORS: Record<string, string> = {
  name: 'نام باید حداقل ۳ حرف باشد.',
  phone: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).',
  address: 'لطفاً استان، شهر و آدرس را کامل وارد کنید.',
  postcode: 'کد پستی باید ۱۰ رقم باشد.',
  gateway: 'درگاه پرداخت در حال حاضر در دسترس نیست.',
  stock: 'موجودی یکی از اقلام سبد خرید شما کافی نیست.',
  'coupon-not_found': 'کد تخفیف یافت نشد.',
  'coupon-inactive': 'این کد تخفیف غیرفعال است.',
  'coupon-expired': 'این کد تخفیف منقضی شده است.',
  'coupon-min_subtotal': 'مبلغ سبد خرید برای استفاده از این کد تخفیف کافی نیست.',
  'coupon-usage_limit_reached': 'سقف استفاده از این کد تخفیف پر شده است.',
  'coupon-not_assigned_to_phone': 'این کد تخفیف مخصوص شماره موبایل دیگری است.',
  unknown: 'مشکلی در ثبت سفارش پیش آمد. دوباره تلاش کنید.',
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const cartToken = (await cookies()).get('cartToken')?.value;
  const cart = await getCart(cartToken);

  if (!cart || cart.items.length === 0) redirect('/cart');

  const gatewayReady = isConfigured();
  const message = error ? (ERRORS[error] ?? ERRORS.unknown) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">تسویه حساب</h1>

      {message && (
        <p role="alert" className="mt-4 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay">
          {message}
        </p>
      )}
      {!gatewayReady && (
        <p role="alert" className="mt-4 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay">
          درگاه پرداخت در حال حاضر پیکربندی نشده است.
        </p>
      )}

      <form action={submitCheckoutAction} className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm text-ink-60">
              نام و نام خانوادگی
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={3}
              className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm text-ink-60">
              شماره موبایل
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              pattern="09[0-9]{9}"
              placeholder="09123456789"
              dir="ltr"
              className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="state" className="block text-sm text-ink-60">
                استان
              </label>
              <input
                id="state"
                name="state"
                required
                className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm text-ink-60">
                شهر
              </label>
              <input
                id="city"
                name="city"
                required
                className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm text-ink-60">
              آدرس کامل
            </label>
            <textarea
              id="address"
              name="address"
              required
              rows={3}
              className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>

          <div>
            <label htmlFor="postcode" className="block text-sm text-ink-60">
              کد پستی
            </label>
            <input
              id="postcode"
              name="postcode"
              required
              pattern="[0-9]{10}"
              inputMode="numeric"
              dir="ltr"
              className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>

          <div>
            <label htmlFor="couponCode" className="block text-sm text-ink-60">
              کد تخفیف (اختیاری)
            </label>
            <input
              id="couponCode"
              name="couponCode"
              dir="ltr"
              className="mt-1.5 w-full border border-cream-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </div>
        </div>

        <aside className="h-max border border-cream-200 p-6 lg:sticky lg:top-24">
          <h2 className="text-sm font-medium">خلاصه سفارش</h2>
          <ul className="mt-4 space-y-2 text-xs text-ink-60">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {item.product.name} × {item.quantity}
                </span>
                <span className="shrink-0">{formatToman(item.variant.price.amount * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-cream-200 pt-3 text-base font-medium">
            <span>جمع کل</span>
            <span>{formatToman(cart.subtotal.amount)}</span>
          </div>
          <button
            type="submit"
            disabled={!gatewayReady}
            className="mt-6 w-full bg-ink py-4 text-center text-sm text-cream transition-colors hover:bg-sand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            پرداخت و ثبت سفارش
          </button>
        </aside>
      </form>
    </div>
  );
}
