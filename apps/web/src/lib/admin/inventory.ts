import 'server-only';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { db } from '@/db/client';
import { inventoryAdjustments, inventoryReservations, productVariants, products } from '@/db/schema';
import { computeResultingStock } from './inventoryValidation';

const ACTIVE_RESERVATION_STATUSES = ['reserved', 'confirmed'] as const;

export type InventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  stock: number;
  reserved: number;
  available: number;
  active: boolean;
};

export async function listInventory(search?: string): Promise<InventoryRow[]> {
  const where = search
    ? or(ilike(products.name, `%${search}%`), ilike(productVariants.sku, `%${search}%`))
    : undefined;

  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      size: productVariants.size,
      color: productVariants.color,
      sku: productVariants.sku,
      stock: productVariants.stock,
      active: productVariants.active,
      reserved: sql<number>`coalesce((
        select sum(${inventoryReservations.quantity}) from ${inventoryReservations}
        where ${inventoryReservations.variantId} = ${productVariants.id}
          and ${inventoryReservations.status} in ${ACTIVE_RESERVATION_STATUSES}
      ), 0)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(where)
    .orderBy(desc(productVariants.createdAt));

  return rows.map((row) => ({ ...row, available: Math.max(row.stock - row.reserved, 0) }));
}

// Row-locks the variant to serialize concurrent admin adjustments (and any
// in-flight checkout reservation) against a stale stock read, mirroring the
// same for('update') pattern lib/commerce/inventory.ts uses at checkout time.
export async function adjustStock(
  variantId: string,
  delta: number,
  reason: string,
  adminId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [variant] = await tx
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .for('update');
    if (!variant) throw new Error('تنوع محصول یافت نشد.');

    const resultingStock = computeResultingStock(variant.stock, delta);

    await tx.update(productVariants).set({ stock: resultingStock }).where(eq(productVariants.id, variantId));
    await tx.insert(inventoryAdjustments).values({ variantId, adminId, delta, resultingStock, reason });

    updateTag('products');
    return resultingStock;
  });
}

export async function listAdjustmentsForVariant(variantId: string) {
  return db
    .select()
    .from(inventoryAdjustments)
    .where(eq(inventoryAdjustments.variantId, variantId))
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(50);
}
