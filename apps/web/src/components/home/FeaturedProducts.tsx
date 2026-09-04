import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import type { Product } from '@/lib/commerce/types';

export function FeaturedProducts({ products }: { products: Product[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-medium">محصولات ویژه</h2>
        <Link href="/collections" className="text-sm text-ink-60 underline-offset-4 hover:text-ink hover:underline">
          مشاهده همه
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}
