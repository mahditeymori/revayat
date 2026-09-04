import Link from 'next/link';
import { site } from '@/lib/site';

// Owns the page's single <h1> and the "مشاهده مجموعه‌ها" CTA — both asserted
// by apps/web/e2e/storefront.spec.ts, must survive verbatim.
export function Hero({
  title,
  subtitle,
  imageUrl,
}: {
  title: string;
  subtitle: string;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return (
      <section className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary-origin hero image */}
        <img
          src={imageUrl}
          alt={title}
          fetchPriority="high"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <h1 className="wordmark text-3xl text-cream sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-xl text-cream/80">{subtitle}</p>
          <Link
            href="/collections"
            className="mt-8 inline-block border border-cream px-8 py-3 text-sm text-cream hover:bg-cream hover:text-ink"
          >
            مشاهده مجموعه‌ها
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-cream-200 bg-cream-50 px-4 py-20 text-center sm:py-28">
      <p
        aria-hidden
        className="wordmark pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-[18vw] leading-none text-ink/5"
      >
        {site.name}
      </p>
      <div className="relative mx-auto max-w-2xl">
        <h1 className="wordmark text-3xl text-ink sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-60">{subtitle}</p>
        <Link
          href="/collections"
          className="mt-8 inline-block border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream"
        >
          مشاهده مجموعه‌ها
        </Link>
      </div>
    </section>
  );
}
