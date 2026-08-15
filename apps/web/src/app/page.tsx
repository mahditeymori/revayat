import Image from 'next/image';
import Link from 'next/link';
import { getProducts, getCategories, getSettings, safe, type Product } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';

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
      <section className="relative flex min-h-[72svh] items-end overflow-hidden bg-ink">
        {settings.heroImage && (
          <Image
            src={settings.heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
          <h1 className="max-w-2xl text-2xl font-medium leading-relaxed text-cream sm:text-3xl">
            {settings.heroTitle}
          </h1>
          {settings.heroSubtitle && (
            <p className="mt-4 max-w-xl text-sm leading-7 text-cream/80">{settings.heroSubtitle}</p>
          )}
          <div className="mt-8 flex gap-4">
            <Link
              href="/collections"
              className="bg-cream px-8 py-3 text-sm text-ink transition-colors hover:bg-sand hover:text-ink"
            >
              دیدن مجموعه‌ها
            </Link>
            <Link
              href="/collections/new"
              className="border border-cream/60 px-8 py-3 text-sm text-cream transition-colors hover:bg-cream hover:text-ink"
            >
              جدیدترین‌ها
            </Link>
          </div>
        </div>
      </section>

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
