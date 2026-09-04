export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getSupportMessageAdmin } from '@/lib/admin/support-messages';
import { replySupportMessageAction, setSupportMessageStatusAction } from '../actions';

const STATUS_LABELS: Record<string, string> = {
  open: 'در انتظار بررسی',
  answered: 'پاسخ داده شده',
  closed: 'بسته شده',
};

export default async function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('support.manage');
  const { id } = await params;
  const item = await getSupportMessageAdmin(id);
  if (!item) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-medium text-slate-900">{item.name}</h1>
        <p className="text-sm text-slate-500">{item.contact}</p>
        <p className="text-xs text-slate-400">کد پیگیری: {item.referenceCode}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-medium text-slate-700">پیام مشتری</h2>
        <p className="whitespace-pre-wrap text-slate-600">{item.message}</p>
      </section>

      {item.adminReply && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium text-slate-700">پاسخ ثبت‌شده</h2>
          <p className="whitespace-pre-wrap text-slate-600">{item.adminReply}</p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">ارسال / ویرایش پاسخ</h2>
        <form action={replySupportMessageAction.bind(null, item.id)} className="space-y-3">
          <textarea
            name="reply"
            defaultValue={item.adminReply ?? ''}
            rows={5}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            ثبت پاسخ
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">وضعیت</h2>
        <form action={setSupportMessageStatusAction.bind(null, item.id)} className="flex items-center gap-3">
          <select
            name="status"
            defaultValue={item.status}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            بروزرسانی وضعیت
          </button>
        </form>
      </section>
    </div>
  );
}
