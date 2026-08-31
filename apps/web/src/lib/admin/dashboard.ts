import 'server-only';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, orders, payments, productVariants, products } from '@/db/schema';

const LOW_STOCK_THRESHOLD = 5;

export type DashboardStats = {
  totalProducts: number;
  activeProducts: number;
  lowStockVariants: number;
  pendingOrders: number;
  paidOrders: number;
  pendingPayments: number;
  failedPayments: number;
  confirmedCouponUsages: number;
  recentOrders: { id: number; status: string; paymentStatus: string; totalRial: number; createdAt: Date }[];
  recentPayments: { id: string; orderId: number; status: string; amountRial: number; createdAt: Date }[];
};

// Every count below is its own small, indexed query rather than one heavy
// join — cheap enough to run on every /admin load without a caching layer.
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    [{ count: totalProducts }],
    [{ count: activeProducts }],
    [{ count: lowStockVariants }],
    [{ count: pendingOrders }],
    [{ count: paidOrders }],
    [{ count: pendingPayments }],
    [{ count: failedPayments }],
    [{ count: confirmedCouponUsages }],
    recentOrders,
    recentPayments,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(products),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.active, true)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(sql`${productVariants.active} and ${productVariants.stock} <= ${LOW_STOCK_THRESHOLD}`),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'pending')),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.paymentStatus, 'paid')),
    db.select({ count: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, 'pending')),
    db.select({ count: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, 'failed')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(inArray(couponUsages.status, ['reserved', 'confirmed'])),
    db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalRial: orders.totalRial,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        status: payments.status,
        amountRial: payments.amountRial,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(5),
  ]);

  return {
    totalProducts,
    activeProducts,
    lowStockVariants,
    pendingOrders,
    paidOrders,
    pendingPayments,
    failedPayments,
    confirmedCouponUsages,
    recentOrders,
    recentPayments,
  };
}
