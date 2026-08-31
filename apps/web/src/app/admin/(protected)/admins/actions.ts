'use server';

import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/admin/session';
import { createAdmin, createAdminInput, setAdminActive } from '@/lib/admin/admins';

export async function createAdminAction(formData: FormData): Promise<void> {
  await requirePermission('admins.manage');
  await createAdmin(
    createAdminInput.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
    }),
  );
  redirect('/admin/admins');
}

export async function toggleAdminActiveAction(id: string, active: boolean): Promise<void> {
  await requirePermission('admins.manage');
  await setAdminActive(id, active);
  redirect('/admin/admins');
}
