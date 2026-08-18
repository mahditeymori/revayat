import Image from 'next/image';
import Link from 'next/link';
import { getProducts, getCategories, getSettings, safe, type Product } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';
import { Hero } from '@/components/Hero';

export const revalidate = 3600;

export default async function HomePage() {
  const [settings, categories, featured, latest] = await Promise.all([
    getSettings(),
    safe(getCategories(), []),
    safe(getProducts({ featured: true }), []),
    safe(getProducts({ sort: 'new' }), []),
  ]);

  return (
    <div>
      <Hero
        image={settings.heroImage}
        title={settings.heroTitle}
        subtitle={settings.heroSubtitle}
      />

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="wordmark text-sm text-ink-60">دسته‌بندی‌ها</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {categories.map((c) => (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden bg-cream-200">
                {c.image && (
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-lg font-medium text-cream">{c.name}</p>
                  <p className="mt-1 text-xs text-cream/75">{c.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductRow title="منتخب روایت" products={featured} href="/collections" />
      <ProductRow title="جدیدترین‌ها" products={latest.slice(0, 4)} href="/collections/new" />
    </div>
  );
}

function ProductRow({ title, products, href }: { title: string; products: Product[]; href: string }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <div className="flex items-baseline justify-between">
        <h2 className="wordmark text-sm text-ink-60">{title}</h2>
        <Link href={href} className="text-xs text-ink-60 underline hover:text-ink">
          دیدن همه
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 4).map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}
