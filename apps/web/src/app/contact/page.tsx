import type { Metadata } from 'next';
import Link from 'next/link';
import { submitContactAction } from './actions';

export const metadata: Metadata = { title: 'تماس با ما', alternates: { canonical: '/contact' } };

const ERRORS: Record<string, string> = {
  'rate-limited': 'تعداد درخواست‌های شما زیاد بوده، کمی بعد دوباره تلاش کنید.',
  invalid: 'لطفاً همه فیلدها را کامل کنید.',
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">تماس با ما</h1>

      {sent ? (
        <div className="mt-8 space-y-4 text-sm leading-8 text-ink-60">
          <p>پیام شما ثبت شد. کد پیگیری شما:</p>
          <p className="text-lg font-medium tracking-widest text-ink">{sent}</p>
          <p>
            برای مشاهده وضعیت و پاسخ، این کد را در{' '}
            <Link href="/contact/track" className="underline hover:text-ink">
              صفحه پیگیری پیام
            </Link>{' '}
            وارد کنید.
          </p>
        </div>
      ) : (
        <form action={submitContactAction} className="mt-8 space-y-5">
          {error && (
            <p role="alert" className="text-sm text-clay">
              {ERRORS[error] ?? 'خطایی رخ داد، دوباره تلاش کنید.'}
            </p>
          )}
          <Field label="نام" name="name" required />
          <Field label="شماره تماس یا ایمیل" name="contact" required />
          <Field label="پیام" name="message" textarea required />
          <button type="submit" className="min-h-11 w-full bg-ink py-3 text-sm text-cream hover:bg-sand-dark">
            ارسال پیام
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  required,
  textarea,
}: {
  label: string;
  name: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const cls =
    'min-h-11 w-full border border-cream-200 bg-transparent px-4 py-3 text-base focus:border-ink focus:outline-none sm:text-sm';
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm text-ink-60">
        {label}
      </label>
      {textarea ? (
        <textarea id={name} name={name} required={required} rows={5} className={cls} />
      ) : (
        <input id={name} name={name} required={required} className={cls} />
      )}
    </div>
  );
}
