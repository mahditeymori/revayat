import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="wordmark text-xs text-ink-60">۴۰۴</p>
      <h1 className="mt-6 text-2xl">این صفحه پیدا نشد</h1>
      <p className="mt-4 text-sm text-ink-60">شاید محصول حذف شده یا نشانی اشتباه است.</p>
      <Link href="/" className="mt-10 border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
        بازگشت به خانه
      </Link>
    </div>
  );
}
