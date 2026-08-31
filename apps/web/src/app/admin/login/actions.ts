'use server';

import { redirect } from 'next/navigation';
import { loginAdmin } from '@/lib/admin/login';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) redirect('/admin/login?error=invalid');

  const result = await loginAdmin(email, password);
  if (!result.ok) redirect(`/admin/login?error=${result.reason}`);
  redirect('/admin');
}
