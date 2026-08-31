'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import {
  createFaq,
  createSupportPage,
  deleteFaq,
  deleteSupportPage,
  faqInput,
  reorderFaqs,
  supportPageInput,
  updateFaq,
  updateSupportPage,
} from '@/lib/admin/support';

export async function createSupportPageAction(formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  const page = await createSupportPage(
    supportPageInput.parse({
      slug: formData.get('slug'),
      title: formData.get('title'),
      bodyHtml: formData.get('bodyHtml') ?? '',
    }),
  );
  redirect(`/admin/support/${page.id}`);
}

export async function updateSupportPageAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  await updateSupportPage(
    id,
    supportPageInput.parse({
      slug: formData.get('slug'),
      title: formData.get('title'),
      bodyHtml: formData.get('bodyHtml') ?? '',
    }),
  );
  redirect('/admin/support');
}

export async function deleteSupportPageAction(id: string): Promise<void> {
  await requirePermission('support.manage');
  await deleteSupportPage(id);
  redirect('/admin/support');
}

export async function createFaqAction(formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  await createFaq(
    faqInput.parse({ question: formData.get('question'), answer: formData.get('answer'), sortOrder: 0 }),
  );
  redirect('/admin/support');
}

export async function updateFaqAction(id: string, formData: FormData): Promise<void> {
  await requirePermission('support.manage');
  await updateFaq(id, faqInput.parse({ question: formData.get('question'), answer: formData.get('answer'), sortOrder: formData.get('sortOrder') }));
  redirect('/admin/support');
}

export async function deleteFaqAction(id: string): Promise<void> {
  await requirePermission('support.manage');
  await deleteFaq(id);
  redirect('/admin/support');
}

export async function reorderFaqsAction(ids: string[]): Promise<void> {
  await requirePermission('support.manage');
  await reorderFaqs(ids);
  redirect('/admin/support');
}
