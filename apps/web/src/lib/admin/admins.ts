import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { admins } from '@/db/schema';
import { hashPassword } from './login';
import { revokeAllSessionsForAdmin } from './session';
import type { AdminRole } from './rbac';

export const createAdminInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, 'رمز عبور باید حداقل ۱۰ کاراکتر باشد.'),
  role: z.enum(['owner', 'admin', 'editor', 'support']),
});

export async function listAdmins() {
  return db
    .select({ id: admins.id, email: admins.email, role: admins.role, active: admins.active, createdAt: admins.createdAt })
    .from(admins)
    .orderBy(desc(admins.createdAt));
}

export async function createAdmin(input: z.infer<typeof createAdminInput>) {
  const existing = await db.query.admins.findFirst({ where: eq(admins.email, input.email) });
  if (existing) throw new Error('این ایمیل قبلاً ثبت شده است.');
  const passwordHash = await hashPassword(input.password);
  const [row] = await db.insert(admins).values({ email: input.email, passwordHash, role: input.role }).returning();
  return row;
}

// Deactivation, not deletion — preserves audit trail (see schema.ts comment
// on admins.active) and immediately invalidates every existing session.
export async function setAdminActive(id: string, active: boolean): Promise<void> {
  await db.update(admins).set({ active }).where(eq(admins.id, id));
  if (!active) await revokeAllSessionsForAdmin(id);
}

export async function setAdminRole(id: string, role: AdminRole): Promise<void> {
  await db.update(admins).set({ role }).where(eq(admins.id, id));
}
