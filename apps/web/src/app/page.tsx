import Link from 'next/link';
import { site } from '@/lib/site';
import { getProducts } from '@/lib/commerce/products';
import { getCategories } from '@/lib/commerce/categories';
import { getSiteSettings } from '@/lib/commerce/settings';
import { ProductCard } from '@/components/ProductCard';
import { safe } from '@/lib/safe';

export default async function HomePage() {
  const [featured, categories, settings] = await Promise.all([
    safe(getProducts({ featured: true }), []),
    safe(getCategories(), []),
    safe(getSiteSettings(), { announcement: '', heroTitle: '', heroSubtitle: '', heroImageUrl: null, footerText: '' }),
  ]);

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
        {settings.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary-origin hero image
          <img src={settings.heroImageUrl} alt="" className="mx-auto mb-8 max-h-64 object-contain" />
        )}
        <h1 className="wordmark text-3xl text-ink sm:text-4xl">{settings.heroTitle || site.nameFa}</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-60">{settings.heroSubtitle || site.tagline}</p>
        <Link
          href="/collections"
          className="mt-8 inline-block border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream"
        >
          مشاهده مجموعه‌ها
        </Link>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/collections/${category.slug}`}
                className="border border-cream-200 px-4 py-6 text-center text-sm hover:border-ink"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-medium">محصولات ویژه</h2>
            <Link href="/collections" className="text-sm text-ink-60 hover:text-ink">
              مشاهده همه
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {featured.length === 0 && categories.length === 0 && (
        <section className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-ink-60">
          <p>در حال آماده‌سازی فروشگاه هستیم — به‌زودی برمی‌گردیم.</p>
          <a
            href={site.socials.instagram}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-4 inline-block underline hover:text-ink"
          >
            دنبال کردن {site.nameFa} در اینستاگرام
          </a>
        </section>
      )}
    </>
  );
}
