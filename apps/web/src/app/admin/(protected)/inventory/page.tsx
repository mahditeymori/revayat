export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import { listInventory } from '@/lib/admin/inventory';
import { adjustStockAction } from './actions';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('inventory.manage');
  const { q } = await searchParams;
  const rows = await listInventory(q);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">موجودی</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="جستجوی محصول یا SKU..."
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
          جستجو
        </button>
      </form>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-right">محصول</th>
            <th className="px-4 py-2 text-right">تنوع</th>
            <th className="px-4 py-2 text-right">SKU</th>
            <th className="px-4 py-2 text-right">موجودی فیزیکی</th>
            <th className="px-4 py-2 text-right">رزرو‌شده</th>
            <th className="px-4 py-2 text-right">قابل فروش</th>
            <th className="px-4 py-2 text-right">تنظیم</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.variantId}>
              <td className="px-4 py-2 text-slate-900">{row.productName}</td>
              <td className="px-4 py-2 text-slate-500">{[row.size, row.color].filter(Boolean).join(' / ') || '-'}</td>
              <td className="px-4 py-2 text-slate-500">{row.sku ?? '-'}</td>
              <td className="px-4 py-2">{row.stock}</td>
              <td className="px-4 py-2 text-slate-500">{row.reserved}</td>
              <td className="px-4 py-2 font-medium">{row.available}</td>
              <td className="px-4 py-2">
                <form action={adjustStockAction.bind(null, row.variantId)} className="flex items-center gap-1">
                  <input
                    name="delta"
                    type="number"
                    placeholder="±"
                    required
                    className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    name="reason"
                    placeholder="دلیل"
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs">
                    ثبت
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                موردی یافت نشد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
