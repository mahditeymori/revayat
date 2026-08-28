import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getProducts, safe, type ProductQuery } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';

export const revalidate = 300;

// 'new' and 'sale' are virtual collections on top of the category list.
const VIRTUAL: Record<string, { name: string; description: string; query: ProductQuery }> = {
  new: { name: 'جدیدترین‌ها', description: 'تازه‌ترین طرح‌های روایت', query: { sort: 'new' } },
  sale: { name: 'تخفیف‌ها', description: 'محصولات دارای تخفیف', query: { onSale: true } },
};

const SORTS = [
  { key: '', label: 'پیش‌فرض' },
  { key: 'price-asc', label: 'ارزان‌ترین' },
  { key: 'price-desc', label: 'گران‌ترین' },
] as const;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

// Next's dynamic route params can arrive still percent-encoded for non-Latin
// segments (see the same fix in lib/catalog.ts's getProductBySlug); decoding
// here is a no-op for a slug with no '%'.
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function resolveCollection(rawSlug: string) {
  const slug = decodeSlug(rawSlug);
  if (VIRTUAL[slug]) return VIRTUAL[slug];
  const categories = await safe(getCategories(), []);
  const cat = categories.find((c) => c.slug === slug);
  return cat ? { name: cat.name, description: cat.description, query: { category: cat.slug } } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = await resolveCollection(slug);
  if (!col) return {};
  return {
    title: col.name,
    description: col.description,
    alternates: { canonical: `/collections/${slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, { sort }] = await Promise.all([params, searchParams]);
  const col = await resolveCollection(slug);
  if (!col) notFound();

  const query: ProductQuery = { ...col.query };
  if (sort === 'price-asc' || sort === 'price-desc') query.sort = sort;
  const products = await safe(getProducts(query), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <nav aria-label="مسیر" className="text-xs text-ink-60">
        <Link href="/" className="hover:text-ink">خانه</Link>
        <span className="mx-2">/</span>
        <Link href="/collections" className="hover:text-ink">مجموعه‌ها</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{col.name}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">{col.name}</h1>
          <p className="mt-2 text-sm text-ink-60">{col.description}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {SORTS.map((s) => {
            const active = (sort ?? '') === s.key;
            const href = s.key ? `/collections/${slug}?sort=${s.key}` : `/collections/${slug}`;
            return (
              <Link
                key={s.key}
                href={href}
                className={`border px-3 py-1.5 transition-colors ${
                  active ? 'border-ink bg-ink text-cream' : 'border-cream-200 hover:border-ink'
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-24 text-center text-sm text-ink-60">محصولی در این مجموعه نیست.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
