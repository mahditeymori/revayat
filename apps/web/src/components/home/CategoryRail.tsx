import Image from 'next/image';
import Link from 'next/link';
import type { Category } from '@/lib/commerce/types';

export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h2 className="text-xl font-medium">مجموعه‌ها</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {categories.map((category) =>
          category.image ? (
            <Link
              key={category.id}
              href={`/collections/${category.slug}`}
              className="group relative block aspect-[3/4] overflow-hidden bg-cream-200"
            >
              <Image
                src={category.image.url}
                alt={category.image.altText || category.name}
                fill
                sizes="(min-width: 640px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/75 to-transparent" />
              <span className="wordmark absolute inset-x-0 bottom-4 text-center text-base text-cream">
                {category.name}
              </span>
            </Link>
          ) : (
            <Link
              key={category.id}
              href={`/collections/${category.slug}`}
              className="border border-cream-200 px-4 py-6 text-center text-sm hover:border-ink"
            >
              {category.name}
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
