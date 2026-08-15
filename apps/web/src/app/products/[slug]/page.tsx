import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getProducts,
  getProductBySlug,
  getCategories,
  getRelated,
  effectivePrice,
  isOnSale,
  safe,
} from '@/lib/catalog';
import { formatToman, discountPercent } from '@/lib/format';
import { site } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';
import { AddToCartForm } from './AddToCartForm';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const products = await safe(getProducts(), []);
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: `${product.subtitle} — ${product.description.slice(0, 140)}`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.subtitle,
      images: product.images[0] ? [{ url: product.images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, categories] = await Promise.all([
    safe(getRelated(product), []),
    safe(getCategories(), []),
  ]);
  const category = categories.find((c) => c.slug === product.category);
  const sale = isOnSale(product);
  const price = effectivePrice(product);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((src) => `${site.url}${src}`),
    brand: { '@type': 'Brand', name: site.name },
    offers: {
      '@type': 'Offer',
      url: `${site.url}/products/${product.slug}`,
      priceCurrency: 'IRR',
      price: price,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="مسیر" className="text-xs text-ink-60">
        <Link href="/" className="hover:text-ink">خانه</Link>
        <span className="mx-2">/</span>
        <Link href="/collections" className="hover:text-ink">مجموعه‌ها</Link>
        {category && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/collections/${category.slug}`} className="hover:text-ink">{category.name}</Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {product.images.map((src, i) => (
            <div key={src} className={`relative aspect-[3/4] bg-cream-200 ${i === 0 ? 'sm:col-span-2' : ''}`}>
              <Image
                src={src}
                alt={`${product.name} — تصویر ${i + 1}`}
                fill
                priority={i === 0}
                sizes={i === 0 ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 30vw, 50vw'}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="wordmark text-xs text-ink-60">{site.name}</p>
          <h1 className="mt-3 text-2xl font-medium">{product.name}</h1>
          <p className="mt-2 text-sm text-ink-60">{product.subtitle}</p>

          <div className="mt-6 flex items-center gap-3">
            <p className="text-lg">{formatToman(price)}</p>
            {sale && (
              <>
                <p className="text-sm text-ink-60 line-through">{formatToman(product.priceRial)}</p>
                <span className="bg-flamingo px-2 py-0.5 text-[11px] text-white">
                  ٪{discountPercent(product.priceRial, price)}
                </span>
              </>
            )}
          </div>

          <div className="mt-8">
            <AddToCartForm product={product} />
          </div>

          <div className="mt-10 space-y-6 border-t border-cream-200 pt-8 text-sm leading-8 text-ink-60">
            <div>
              <h2 className="mb-2 font-medium text-ink">داستان طرح</h2>
              <p>{product.description}</p>
            </div>
            <div>
              <h2 className="mb-2 font-medium text-ink">جنس و نگهداری</h2>
              <p>پنبه سوپر درجه‌یک، دوخت اورسایز. شست‌وشو با آب سرد، اتو از پشت پارچه.</p>
            </div>
            <div>
              <h2 className="mb-2 font-medium text-ink">ارسال</h2>
              <p>ارسال به سراسر ایران؛ تهران ۱ تا ۲ روز کاری، سایر شهرها ۲ تا ۴ روز کاری.</p>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="wordmark text-sm text-ink-60">شاید بپسندید</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
