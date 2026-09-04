export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requirePermission } from '@/lib/admin/session';
import { listSupportMessagesAdmin } from '@/lib/admin/support-messages';

const STATUS_LABELS: Record<string, string> = {
  open: 'در انتظار بررسی',
  answered: 'پاسخ داده شده',
  closed: 'بسته شده',
};

const STATUS_CLASSES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  answered: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-100 text-slate-600',
};

export default async function InboxPage() {
  await requirePermission('support.manage');
  const messages = await listSupportMessagesAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">پیام‌های مشتریان</h1>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-right text-slate-500">
          <tr>
            <th className="px-4 py-2 font-normal">نام</th>
            <th className="px-4 py-2 font-normal">تماس</th>
            <th className="px-4 py-2 font-normal">وضعیت</th>
            <th className="px-4 py-2 font-normal">تاریخ</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <Link href={`/admin/inbox/${m.id}`} className="text-slate-900 hover:underline">
                  {m.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-600">{m.contact}</td>
              <td className="px-4 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASSES[m.status]}`}>
                  {STATUS_LABELS[m.status] ?? m.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500">
                {new Date(m.createdAt).toLocaleDateString('fa-IR')}
              </td>
            </tr>
          ))}
          {messages.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                پیامی ثبت نشده است.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
