import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/lib/site';

// Homepage hero. `image` is admin-editable (settings.heroImage) — drop a real
// brand photograph in there and it takes over the backdrop. Without one the
// section still reads as intentional rather than broken: brand mark, headline
// and a warm ink/sand wash.
export function Hero({
  image,
  title,
  subtitle,
}: {
  image?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative flex min-h-[78svh] items-end overflow-hidden bg-ink">
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          priority
          // Above the fold on every visit — the one image worth preloading eagerly.
          fetchPriority="high"
          sizes="100vw"
          quality={70}
          className="object-cover object-center opacity-75"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,var(--color-sand-dark),transparent_60%),radial-gradient(ellipse_at_75%_75%,var(--color-clay),transparent_55%)] opacity-70"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/10" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-32 sm:px-6">
        <p className="wordmark text-xs text-cream/70">{site.name}</p>
        <h1 className="mt-5 max-w-3xl text-3xl font-medium leading-[1.5] text-cream sm:text-4xl sm:leading-[1.45]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-xl text-sm leading-8 text-cream/80">{subtitle}</p>
        )}
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/collections"
            className="bg-cream px-8 py-3.5 text-sm text-ink transition-colors hover:bg-sand"
          >
            دیدن مجموعه‌ها
          </Link>
          <Link
            href="/collections/new"
            className="border border-cream/50 px-8 py-3.5 text-sm text-cream backdrop-blur-sm transition-colors hover:bg-cream hover:text-ink"
          >
            جدیدترین‌ها
          </Link>
        </div>
      </div>
    </section>
  );
}
