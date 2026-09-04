import { site } from '@/lib/site';
import { getProducts } from '@/lib/commerce/products';
import { getCategories } from '@/lib/commerce/categories';
import { getSiteSettings } from '@/lib/commerce/settings';
import { safe } from '@/lib/safe';
import { HomeHeader } from '@/components/home/HomeHeader';
import { Hero } from '@/components/home/Hero';
import { CategoryRail } from '@/components/home/CategoryRail';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { BrandStory } from '@/components/home/BrandStory';

export default async function HomePage() {
  const [featured, categories, settings] = await Promise.all([
    safe(getProducts({ featured: true }), []),
    safe(getCategories(), []),
    safe(getSiteSettings(), { announcement: '', heroTitle: '', heroSubtitle: '', heroImageUrl: null, footerText: '' }),
  ]);

  return (
    <>
      <HomeHeader />
      <Hero
        title={settings.heroTitle || site.nameFa}
        subtitle={settings.heroSubtitle || site.tagline}
        imageUrl={settings.heroImageUrl}
      />

      {categories.length > 0 && <CategoryRail categories={categories} />}
      <BrandStory image={categories.find((c) => c.image)?.image ?? featured[0]?.images[0] ?? null} />
      {featured.length > 0 && <FeaturedProducts products={featured} />}

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
