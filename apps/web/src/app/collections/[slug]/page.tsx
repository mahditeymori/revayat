import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategory } from '@/lib/commerce/categories';
import { getProducts, type GetProductsParams } from '@/lib/commerce/products';
import { ProductCard } from '@/components/ProductCard';
import { site } from '@/lib/site';

// Not statically generated: categories are admin-editable, so a build-time
// param list would go stale, and generateStaticParams here collided with
// this page's searchParams read (DYNAMIC_SERVER_USAGE) for any slug outside
// that list — 500s on every category not present at build time, including
// the hardcoded 'new'/'sale' virtual collections. Every sibling commerce
// route (/products/[slug], /search, /checkout) is already fully dynamic.
export const dynamic = 'force-dynamic';

// 'new' and 'sale' are virtual collections layered on top of the category
// list — they map to a getProducts() query, not a categories row.
const VIRTUAL: Record<string, { name: string; description: string; query: GetProductsParams }> = {
  new: { name: 'جدیدترین‌ها', description: 'تازه‌ترین طرح‌های روایت', query: { sort: 'newest' } },
  sale: { name: 'تخفیف‌ها', description: 'محصولات دارای تخفیف', query: { onSale: true } },
};

const SORTS = [
  { key: '', label: 'پیش‌فرض' },
  { key: 'price-asc', label: 'ارزان‌ترین' },
  { key: 'price-desc', label: 'گران‌ترین' },
] as const;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function resolveCollection(rawSlug: string) {
  const slug = decodeSlug(rawSlug);
  if (VIRTUAL[slug]) return { slug, ...VIRTUAL[slug] };
  const category = await getCategory(slug);
  if (!category) return null;
  return { slug, name: category.name, description: category.description, query: { categorySlug: category.slug } };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = await resolveCollection(slug);
  if (!col) return {};
  return {
    title: col.name,
    description: col.description,
    alternates: { canonical: `/collections/${col.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, { sort }] = await Promise.all([params, searchParams]);
  const col = await resolveCollection(slug);
  if (!col) notFound();

  const query: GetProductsParams = { ...col.query };
  if (sort === 'price-asc' || sort === 'price-desc') query.sort = sort;
  const products = await getProducts(query);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: site.url },
      { '@type': 'ListItem', position: 2, name: 'مجموعه‌ها', item: `${site.url}/collections` },
      { '@type': 'ListItem', position: 3, name: col.name, item: `${site.url}/collections/${col.slug}` },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="مسیر" className="text-xs text-ink-60">
        <Link href="/" className="hover:text-ink">
          خانه
        </Link>
        <span className="mx-2">/</span>
        <Link href="/collections" className="hover:text-ink">
          مجموعه‌ها
        </Link>
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
            const href = s.key ? `/collections/${col.slug}?sort=${s.key}` : `/collections/${col.slug}`;
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
