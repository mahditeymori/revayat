import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { couponUsages, coupons, orders } from '@/db/schema';
import { updateTag } from 'next/cache';
import { couponInput, maskPhone, type CouponInput } from './couponValidation';

export { couponInput, maskPhone };
export type { CouponInput };

export async function listCouponsAdmin() {
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getCouponAdmin(id: string) {
  return db.query.coupons.findFirst({ where: eq(coupons.id, id) });
}

async function assertCodeFree(code: string, excludeId?: string) {
  const existing = await db.query.coupons.findFirst({ where: eq(coupons.code, code) });
  if (existing && existing.id !== excludeId) throw new Error('کد تخفیف تکراری است.');
}

export async function createCoupon(input: CouponInput) {
  await assertCodeFree(input.code);
  const [row] = await db.insert(coupons).values(input).returning();
  updateTag('coupons');
  return row;
}

export async function updateCoupon(id: string, input: CouponInput) {
  await assertCodeFree(input.code, id);
  await db.update(coupons).set(input).where(eq(coupons.id, id));
  updateTag('coupons');
}

export async function setCouponActive(id: string, active: boolean) {
  await db.update(coupons).set({ active }).where(eq(coupons.id, id));
  updateTag('coupons');
}

// Usage history for one coupon: who redeemed it (masked phone), which order,
// current hold/confirm/release status, and the order's discount/total.
export async function getCouponUsageHistory(couponId: string) {
  const rows = await db
    .select({
      id: couponUsages.id,
      customerPhone: couponUsages.customerPhone,
      status: couponUsages.status,
      createdAt: couponUsages.createdAt,
      orderId: couponUsages.orderId,
      orderStatus: orders.status,
      discountRial: orders.discountRial,
      totalRial: orders.totalRial,
    })
    .from(couponUsages)
    .innerJoin(orders, eq(orders.id, couponUsages.orderId))
    .where(eq(couponUsages.couponId, couponId))
    .orderBy(desc(couponUsages.createdAt));

  return rows.map((r) => ({ ...r, maskedPhone: maskPhone(r.customerPhone) }));
}
