export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { getSupportPageAdmin } from '@/lib/admin/support';
import SupportPageForm from '../SupportPageForm';
import { updateSupportPageAction } from '../actions';

export default async function EditSupportPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('support.manage');
  const { id } = await params;
  const page = await getSupportPageAdmin(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-slate-900">{page.title}</h1>
      <SupportPageForm action={updateSupportPageAction.bind(null, id)} defaultValues={page} />
    </div>
  );
}
