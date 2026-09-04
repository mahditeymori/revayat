'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { replySupportMessage, setSupportMessageStatus } from '@/lib/admin/support-messages';

export async function replySupportMessageAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  const reply = String(formData.get('reply') ?? '').trim();
  if (reply) await replySupportMessage(id, reply);
  redirect(`/admin/inbox/${id}`);
}

export async function setSupportMessageStatusAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  const status = String(formData.get('status') ?? '');
  if (status === 'open' || status === 'answered' || status === 'closed') {
    await setSupportMessageStatus(id, status);
  }
  redirect(`/admin/inbox/${id}`);
}
