export const dynamic = 'force-dynamic';

import { requirePermission } from '@/lib/admin/session';
import SupportPageForm from '../SupportPageForm';
import { createSupportPageAction } from '../actions';

export default async function NewSupportPage() {
  await requirePermission('support.manage');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">صفحه پشتیبانی جدید</h1>
      <SupportPageForm action={createSupportPageAction} />
    </div>
  );
}
