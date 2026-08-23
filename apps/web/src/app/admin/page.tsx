import Image from 'next/image';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { formatToman } from '@/lib/format';
import { requireAdminPage } from '@/lib/admin';

export default async function AdminProductsPage() {
  // Layouts do not gate the pages beneath them — see requireAdminPage.
  await requireAdminPage();

  const { products } = await getCatalog();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">محصولات</h1>
        <Link href="/admin/products/new" className="bg-ink px-5 py-3 text-xs text-cream hover:bg-sand-dark">
          محصول جدید
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-cream-200 border border-cream-200">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/products/${p.id}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-cream-50"
            >
              <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-cream-200">
                {p.images[0] && (
                  <Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-ink-60">{p.slug}</p>
              </div>
              <div className="text-left text-sm">
                <p>{formatToman(p.salePriceRial ?? p.priceRial)}</p>
                <p className="mt-1 text-xs text-ink-60">
                  {p.inStock ? 'موجود' : 'ناموجود'}
                  {p.featured && ' · منتخب'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
