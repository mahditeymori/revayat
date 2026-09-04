import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategory } from '@/lib/commerce/categories';
import { getProduct, getProductRecommendations } from '@/lib/commerce/products';
import { site } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';
import { ProductGallery } from '@/components/ProductGallery';
import { VariantSelector } from '@/components/VariantSelector';
import { effectivePrice } from '@/components/ProductCard';

type Props = { params: Promise<{ slug: string }> };

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(decodeSlug(slug));
  if (!product) return {};
  return {
    title: product.name,
    description: `${product.subtitle} — ${product.description.slice(0, 140)}`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.subtitle,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(decodeSlug(slug));
  if (!product) notFound();

  const [category, related] = await Promise.all([
    product.categorySlug ? getCategory(product.categorySlug) : Promise.resolve(null),
    getProductRecommendations(product.id),
  ]);

  const price = effectivePrice(product);
  const inStock = product.variants.some((v) => v.availableForSale);
  const specs = [
    { label: 'جنس', value: product.material },
    { label: 'نوع پارچه', value: product.fabricType },
    { label: 'وزن', value: product.weight },
  ].filter((s) => s.value);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((img) => `${site.url}${img.url}`),
    brand: { '@type': 'Brand', name: site.nameFa },
    offers: {
      '@type': 'Offer',
      url: `${site.url}/products/${product.slug}`,
      priceCurrency: 'IRR',
      price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const breadcrumbItems = [
    { name: 'خانه', item: site.url },
    { name: 'مجموعه‌ها', item: `${site.url}/collections` },
    ...(category ? [{ name: category.name, item: `${site.url}/collections/${category.slug}` }] : []),
    { name: product.name, item: `${site.url}/products/${product.slug}` },
  ];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: b.item,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
        {category && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/collections/${category.slug}`} className="hover:text-ink">
              {category.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <ProductGallery images={product.images} name={product.name} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="wordmark text-xs text-ink-60">{site.name}</p>
          <h1 className="mt-3 text-2xl font-medium">{product.name}</h1>
          <p className="mt-2 text-sm text-ink-60">{product.subtitle}</p>

          <div className="mt-6">
            <VariantSelector product={product} />
          </div>

          <div className="mt-10 space-y-6 border-t border-cream-200 pt-8 text-sm leading-8 text-ink-60">
            <div>
              <h2 className="mb-2 font-medium text-ink">داستان طرح</h2>
              <p>{product.description}</p>
            </div>
            {(specs.length > 0 || product.additionalNotes) && (
              <div>
                <h2 className="mb-2 font-medium text-ink">مشخصات محصول</h2>
                {specs.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {specs.map((s) => (
                      <div key={s.label} className="contents">
                        <dt className="text-ink">{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {product.additionalNotes && <p className="mt-2">{product.additionalNotes}</p>}
              </div>
            )}
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
