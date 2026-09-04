import 'server-only';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { supportMessages } from '@/db/schema';

function generateReferenceCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export async function createSupportMessage(input: { name: string; contact: string; message: string }) {
  // Retries only guard against the astronomically unlikely 8-char collision —
  // the unique constraint on reference_code is the actual safety net.
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceCode = generateReferenceCode();
    const existing = await db.query.supportMessages.findFirst({ where: eq(supportMessages.referenceCode, referenceCode) });
    if (existing) continue;
    const [row] = await db.insert(supportMessages).values({ ...input, referenceCode }).returning();
    return row;
  }
  throw new Error('امکان ثبت پیام وجود ندارد، دوباره تلاش کنید.');
}

export async function getSupportMessageByReferenceCode(referenceCode: string) {
  return db.query.supportMessages.findFirst({
    where: eq(supportMessages.referenceCode, referenceCode.trim().toUpperCase()),
  });
}
