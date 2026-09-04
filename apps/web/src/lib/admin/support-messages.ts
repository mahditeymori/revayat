import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { supportMessages } from '@/db/schema';

export async function listSupportMessagesAdmin() {
  return db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt));
}

export async function getSupportMessageAdmin(id: string) {
  return db.query.supportMessages.findFirst({ where: eq(supportMessages.id, id) });
}

export async function replySupportMessage(id: string, reply: string) {
  const [row] = await db
    .update(supportMessages)
    .set({ adminReply: reply, repliedAt: new Date(), status: 'answered' })
    .where(eq(supportMessages.id, id))
    .returning();
  return row;
}

export async function setSupportMessageStatus(id: string, status: 'open' | 'answered' | 'closed') {
  const [row] = await db.update(supportMessages).set({ status }).where(eq(supportMessages.id, id)).returning();
  return row;
}
