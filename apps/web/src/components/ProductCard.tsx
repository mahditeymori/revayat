import Image from 'next/image';
import Link from 'next/link';
import { discountPercent, formatToman } from '@/lib/format';
import { site } from '@/lib/site';
import { QuickAdd } from '@/components/QuickAdd';
import type { Product } from '@/lib/commerce/types';

export function isOnSale(product: Product): boolean {
  return product.salePrice != null && product.salePrice.amount < product.price.amount;
}

export function effectivePrice(product: Product): number {
  return isOnSale(product) ? product.salePrice!.amount : product.price.amount;
}

export function isInStock(product: Product): boolean {
  return product.variants.some((v) => v.availableForSale);
}

// Farfetch-style card: portrait image with quiet hover-swap to the second
// photo, brand line above the product name, tiny type, lots of air.
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const sale = isOnSale(product);
  const price = effectivePrice(product);
  const inStock = isInStock(product);
  const [first, second] = product.images;

  return (
    <div className="group relative">
      <Link href={`/products/${product.slug}`} className="absolute inset-0 z-0" aria-label={product.name} />
      <div className="relative aspect-[3/4] overflow-hidden bg-cream-200">
        {first && (
          <Image
            src={first.url}
            alt={first.altText || product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-opacity duration-300 group-hover:opacity-0"
          />
        )}
        {second && (
          <Image
            src={second.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {sale && (
          <span className="absolute right-0 top-3 bg-flamingo px-2 py-1 text-[11px] text-white">
            ٪{discountPercent(product.price.amount, price)} تخفیف
          </span>
        )}
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-2 text-center text-xs text-cream">
            ناموجود
          </span>
        )}
      </div>
      {inStock && (
        <div className="relative z-10 -mt-11 sm:mt-0">
          <QuickAdd product={product} />
        </div>
      )}
      <div className="mt-3 space-y-1">
        <p className="wordmark text-[10px] text-ink-60">{site.name}</p>
        <p className="text-sm font-medium leading-6">{product.name}</p>
        <p className="text-xs text-ink-60">{product.subtitle}</p>
        <p className="flex gap-2 pt-1 text-sm">
          <span>{formatToman(price)}</span>
          {sale && <span className="text-ink-60 line-through">{formatToman(product.price.amount)}</span>}
        </p>
      </div>
    </div>
  );
}
