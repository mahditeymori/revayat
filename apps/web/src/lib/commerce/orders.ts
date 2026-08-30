import 'server-only';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, orderItems, orders, productVariants, products } from '@/db/schema';
import { getCart } from './cart';
import { applyCoupon, CouponRejectedError, validateCoupon } from './coupons';
import { InsufficientStockError, reserveStock } from './inventory';
import type { Order, OrderItem, OrderStatus, PaymentStatus, ShippingInput } from './types';
import { toRial } from './types';

export { CouponRejectedError, InsufficientStockError };

type OrderRow = {
  id: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  cartToken: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  subtotalRial: number;
  discountRial: number;
  shippingRial: number;
  totalRial: number;
  createdAt: Date;
};

type OrderItemRow = {
  id: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  unitPriceRial: number;
  quantity: number;
};

function mapOrder(orderRow: OrderRow, itemRows: OrderItemRow[]): Order {
  const items: OrderItem[] = itemRows.map((item) => ({
    id: item.id,
    variantId: item.variantId,
    productName: item.productName,
    variantTitle: item.variantTitle,
    unitPrice: toRial(item.unitPriceRial),
    quantity: item.quantity,
  }));

  return {
    id: orderRow.id,
    status: orderRow.status,
    paymentStatus: orderRow.paymentStatus,
    cartToken: orderRow.cartToken,
    shipping: {
      name: orderRow.shippingName,
      phone: orderRow.shippingPhone,
      address: orderRow.shippingAddress,
      postalCode: orderRow.shippingPostalCode,
    },
    items,
    subtotal: toRial(orderRow.subtotalRial),
    discount: toRial(orderRow.discountRial),
    shippingCost: toRial(orderRow.shippingRial),
    total: toRial(orderRow.totalRial),
    createdAt: orderRow.createdAt,
  };
}

export type CreateOrderInput = {
  cartToken: string;
  shipping: ShippingInput;
  couponCode?: string;
};

// Single transaction: re-resolves live prices for every cart line, validates
// the coupon (if any), reserves stock (throws if any line is short), reserves
// the coupon usage, computes totals server-side, and snapshots everything
// onto order_items. Does NOT create a `payments` row — that's
// lib/zibal/payment-flow.ts's startPayment, a separate step so retries can
// create fresh payment attempts against the same order.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const cart = await getCart(input.cartToken);
  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  return db.transaction(async (tx) => {
    const variantIds = cart.items.map((item) => item.variantId);
    const liveVariants = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        priceRial: productVariants.priceRial,
        active: productVariants.active,
      })
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds));
    const liveVariantById = new Map(liveVariants.map((v) => [v.id, v]));

    const liveProductRows = await tx
      .select({ id: products.id, name: products.name, priceRial: products.priceRial })
      .from(products)
      .where(inArray(products.id, [...new Set(liveVariants.map((v) => v.productId))]));
    const liveProductById = new Map(liveProductRows.map((p) => [p.id, p]));

    const lines = cart.items.map((item) => {
      const liveVariant = liveVariantById.get(item.variantId);
      if (!liveVariant || !liveVariant.active) {
        throw new InsufficientStockError(item.variantId);
      }
      const liveProduct = liveProductById.get(liveVariant.productId);
      const unitPriceRial = liveVariant.priceRial ?? liveProduct?.priceRial ?? item.variant.price.amount;
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        productName: liveProduct?.name ?? item.product.name,
        variantTitle: item.variant.title,
        unitPriceRial,
      };
    });

    const subtotalRial = lines.reduce((sum, line) => sum + line.unitPriceRial * line.quantity, 0);

    let discountRial = 0;
    let couponId: string | null = null;
    if (input.couponCode) {
      const result = await validateCoupon(input.couponCode, input.shipping.phone, subtotalRial);
      if (!result.ok) {
        throw new CouponRejectedError(result.reason);
      }
      discountRial = result.discountRial;
      couponId = result.couponId;
    }

    const shippingRial = 0;
    const totalRial = Math.max(subtotalRial - discountRial + shippingRial, 0);

    const [customer] = await tx
      .insert(customers)
      .values({ phone: input.shipping.phone, fullName: input.shipping.name })
      .onConflictDoUpdate({ target: customers.phone, set: { fullName: input.shipping.name } })
      .returning();

    const [orderRow] = await tx
      .insert(orders)
      .values({
        customerId: customer.id,
        cartToken: input.cartToken,
        shippingName: input.shipping.name,
        shippingPhone: input.shipping.phone,
        shippingAddress: input.shipping.address,
        shippingPostalCode: input.shipping.postalCode,
        subtotalRial,
        discountRial,
        shippingRial,
        totalRial,
        couponId,
      })
      .returning();

    await reserveStock(
      tx,
      orderRow.id,
      lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
    );
    if (couponId) {
      await applyCoupon(tx, orderRow.id, couponId, input.shipping.phone);
    }

    const insertedItems = await tx
      .insert(orderItems)
      .values(
        lines.map((line) => ({
          orderId: orderRow.id,
          variantId: line.variantId,
          productName: line.productName,
          variantTitle: line.variantTitle,
          unitPriceRial: line.unitPriceRial,
          quantity: line.quantity,
        })),
      )
      .returning();

    return mapOrder(orderRow, insertedItems);
  });
}

export async function getOrder(id: number): Promise<Order | null> {
  const orderRow = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!orderRow) return null;
  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return mapOrder(orderRow, itemRows);
}

export type ListOrdersFilters = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
  offset?: number;
};

export async function listOrders(filters: ListOrdersFilters = {}): Promise<Order[]> {
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.paymentStatus) conditions.push(eq(orders.paymentStatus, filters.paymentStatus));

  const orderRows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((row) => row.id);
  const itemRows = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
  const itemsByOrder = new Map<number, OrderItemRow[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return orderRows.map((row) => mapOrder(row, itemsByOrder.get(row.id) ?? []));
}

// Fulfillment lifecycle only — never touches paymentStatus, which is owned
// exclusively by lib/zibal/payment-flow.ts.
export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
}
