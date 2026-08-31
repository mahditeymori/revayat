export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listFaqsAdmin, listSupportPagesAdmin } from '@/lib/admin/support';
import { createFaqAction, deleteFaqAction, deleteSupportPageAction, reorderFaqsAction, updateFaqAction } from './actions';

function moveUp<T extends { id: string }>(items: T[], index: number): string[] {
  const ids = items.map((i) => i.id);
  if (index === 0) return ids;
  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
  return ids;
}

export default async function SupportPage() {
  await requirePermission('support.manage');
  const [pages, faqs] = await Promise.all([listSupportPagesAdmin(), listFaqsAdmin()]);

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-slate-900">صفحات پشتیبانی</h1>
          <Link href="/admin/support/new" className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">
            صفحه جدید
          </Link>
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
          {pages.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/admin/support/${p.id}`} className="text-slate-900 hover:underline">
                {p.title} <span className="text-slate-400">({p.slug})</span>
              </Link>
              <form action={deleteSupportPageAction.bind(null, p.id)}>
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  حذف
                </button>
              </form>
            </li>
          ))}
          {pages.length === 0 && <li className="px-4 py-6 text-center text-slate-400">صفحه‌ای ثبت نشده است.</li>}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-900">سوالات متداول</h2>
        <ul className="space-y-2">
          {faqs.map((f, index) => (
            <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <form action={updateFaqAction.bind(null, f.id)} className="space-y-2">
                <input type="hidden" name="sortOrder" value={f.sortOrder} />
                <input
                  name="question"
                  defaultValue={f.question}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="سوال"
                />
                <textarea
                  name="answer"
                  defaultValue={f.answer}
                  rows={2}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="پاسخ"
                />
                <div className="flex gap-2">
                  <button type="submit" className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
                    ذخیره
                  </button>
                  {index > 0 && (
                    <button
                      type="submit"
                      formAction={reorderFaqsAction.bind(null, moveUp(faqs, index))}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      بالا
                    </button>
                  )}
                </div>
              </form>
              <form action={deleteFaqAction.bind(null, f.id)} className="mt-2">
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  حذف
                </button>
              </form>
            </li>
          ))}
          {faqs.length === 0 && <li className="text-sm text-slate-400">سوالی ثبت نشده است.</li>}
        </ul>

        <form action={createFaqAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium text-slate-900">افزودن سوال جدید</p>
          <input name="question" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="سوال" />
          <textarea name="answer" required rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="پاسخ" />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            افزودن
          </button>
        </form>
      </section>
    </div>
  );
}
