export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listProductsAdmin } from '@/lib/admin/products';

const RIAL = new Intl.NumberFormat('fa-IR');

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission('products.manage');
  const { q, page } = await searchParams;
  const products = await listProductsAdmin({ search: q, page: page ? Number(page) : 1 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">محصولات</h1>
        <Link href="/admin/products/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          محصول جدید
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="جستجوی نام محصول..."
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
          جستجو
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">نام</th>
            <th className="px-4 py-2 text-right">قیمت</th>
            <th className="px-4 py-2 text-right">وضعیت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/products/${p.id}`} className="text-slate-900 hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-500">{RIAL.format(p.priceRial)} ریال</td>
              <td className="px-4 py-2">
                <span className={p.active ? 'text-emerald-600' : 'text-slate-400'}>{p.active ? 'فعال' : 'غیرفعال'}</span>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                محصولی یافت نشد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
