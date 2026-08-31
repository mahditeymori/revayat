import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, payments } from '@/db/schema';

export async function listPayments(limit = 100) {
  return db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      trackId: payments.trackId,
      amountRial: payments.amountRial,
      status: payments.status,
      gatewayRefNumber: payments.gatewayRefNumber,
      createdAt: payments.createdAt,
      verifiedAt: payments.verifiedAt,
    })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function listPaymentsForOrder(orderId: number) {
  return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
}

export async function getPayment(id: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!payment) return null;
  const order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  return { payment, order };
}
