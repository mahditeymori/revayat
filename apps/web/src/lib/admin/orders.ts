import 'server-only';
import { getOrder, listOrders, updateOrderStatus, type ListOrdersFilters } from '@/lib/commerce/orders';
import type { OrderStatus } from '@/lib/commerce/types';
import { ALLOWED_TRANSITIONS, InvalidOrderTransitionError } from './orderTransitions';

export { getOrder, listOrders, ALLOWED_TRANSITIONS, InvalidOrderTransitionError };
export type { ListOrdersFilters };

export async function updateOrderStatusAdmin(id: number, next: OrderStatus): Promise<void> {
  const order = await getOrder(id);
  if (!order) throw new Error('سفارش یافت نشد.');
  if (order.status === next) return;

  if (!ALLOWED_TRANSITIONS[order.status].includes(next)) {
    throw new InvalidOrderTransitionError(order.status, next);
  }
  await updateOrderStatus(id, next);
}
