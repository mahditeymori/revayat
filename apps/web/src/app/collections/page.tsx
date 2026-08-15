import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCategories, getProducts, safe } from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'مجموعه‌ها',
  description: 'مجموعه تی‌شرت‌های روایت — اسطوره، طبیعت و میراث ایران',
  alternates: { canonical: '/collections' },
};

export default async function CollectionsPage() {
  const [categories, products] = await Promise.all([
    safe(getCategories(), []),
    safe(getProducts(), []),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-medium">مجموعه‌ها</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.slug} href={`/collections/${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-cream-200">
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
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="font-medium text-cream">{c.name}</p>
              <p className="mt-1 text-xs text-cream/75">{c.count} محصول</p>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="wordmark mt-20 text-sm text-ink-60">همه محصولات</h2>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 4} />
        ))}
      </div>
    </div>
  );
}
