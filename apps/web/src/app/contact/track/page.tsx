import type { Metadata } from 'next';
import { getSupportMessageByReferenceCode } from '@/lib/commerce/support-messages';

export const metadata: Metadata = { title: 'پیگیری پیام', alternates: { canonical: '/contact/track' } };

const STATUS_LABELS: Record<string, string> = {
  open: 'در انتظار بررسی',
  answered: 'پاسخ داده شده',
  closed: 'بسته شده',
};

export default async function TrackContactPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const query = (code ?? '').trim();
  const result = query ? await getSupportMessageByReferenceCode(query) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">پیگیری پیام</h1>
      <form action="/contact/track" method="get" className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="code">
          کد پیگیری
        </label>
        <input
          id="code"
          name="code"
          defaultValue={query}
          placeholder="کد پیگیری ۸ رقمی"
          className="min-h-11 flex-1 border border-cream-200 bg-transparent px-4 py-3 text-base focus:border-ink focus:outline-none sm:text-sm"
        />
        <button type="submit" className="min-h-11 bg-ink px-6 py-3 text-sm text-cream hover:bg-sand-dark">
          جستجو
        </button>
      </form>

      {query && !result && <p className="mt-8 text-sm text-ink-60">پیامی با این کد پیدا نشد.</p>}

      {result && (
        <div className="mt-8 space-y-6 border-t border-cream-200 pt-8 text-sm leading-8 text-ink-60">
          <div>
            <h2 className="mb-2 font-medium text-ink">وضعیت</h2>
            <p>{STATUS_LABELS[result.status] ?? result.status}</p>
          </div>
          <div>
            <h2 className="mb-2 font-medium text-ink">پیام شما</h2>
            <p>{result.message}</p>
          </div>
          {result.adminReply && (
            <div>
              <h2 className="mb-2 font-medium text-ink">پاسخ ما</h2>
              <p>{result.adminReply}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
