import type { Metadata } from 'next';
import { searchProducts } from '@/lib/commerce/search';
import { ProductCard } from '@/components/ProductCard';

export const metadata: Metadata = { title: 'جستجو', alternates: { canonical: '/search' } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim().slice(0, 100);
  const results = query ? await searchProducts(query) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">جستجو</h1>
      <form action="/search" method="get" className="mt-6 flex max-w-lg gap-2">
        <label className="sr-only" htmlFor="q">
          عبارت جستجو
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="مثلاً دماوند…"
          className="min-h-11 flex-1 border border-cream-200 bg-transparent px-4 py-3 text-base focus:border-ink focus:outline-none sm:text-sm"
        />
        <button type="submit" className="min-h-11 bg-ink px-6 py-3 text-sm text-cream hover:bg-sand-dark">
          جستجو
        </button>
      </form>

      {query && (
        <p className="mt-10 text-sm text-ink-60">
          {results.length === 0
            ? `نتیجه‌ای برای «${query}» پیدا نشد.`
            : `${results.length} نتیجه برای «${query}»`}
        </p>
      )}
      {results.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
