import Image from 'next/image';
import { site } from '@/lib/site';

// Static editorial band — no schema changes. Uses copy already defined in
// site.ts and an image already fetched on the homepage (no new data fetch).
export function BrandStory({ image }: { image: { url: string; altText: string } | null }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        {image && (
          <div className="relative order-2 aspect-[4/5] overflow-hidden bg-cream-200 md:order-1">
            <Image src={image.url} alt={image.altText} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
        <div className={image ? 'order-1 md:order-2' : ''}>
          <p className="wordmark text-2xl leading-relaxed text-ink sm:text-3xl">{site.tagline}</p>
          <p className="mt-6 max-w-md text-sm leading-8 text-ink-60">{site.description}</p>
        </div>
      </div>
    </section>
  );
}
