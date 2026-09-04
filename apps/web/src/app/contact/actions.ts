'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupportMessage } from '@/lib/commerce/support-messages';
import { checkRateLimit } from '@/lib/security/rate-limit';

const SUBMIT_WINDOW_MS = 60 * 60 * 1000;

export async function submitContactAction(formData: FormData): Promise<void> {
  const h = await headers();
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown';
  const limit = await checkRateLimit(`contact-submit:ip:${ip}`, { limit: 5, windowMs: SUBMIT_WINDOW_MS });
  if (!limit.allowed) redirect('/contact?error=rate-limited');

  const name = String(formData.get('name') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!name || !contact || !message) redirect('/contact?error=invalid');
  if (name.length > 200 || contact.length > 200 || message.length > 5000) redirect('/contact?error=invalid');

  const row = await createSupportMessage({ name, contact, message });
  redirect(`/contact?sent=${row.referenceCode}`);
}
