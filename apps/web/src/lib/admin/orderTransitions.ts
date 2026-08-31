// Pure fulfillment state machine, split out of orders.ts (which pulls in
// 'server-only' + DB) so it's testable without a request/DB context —
// mirrors lib/commerce/checkoutValidation.ts's split.
import type { OrderStatus } from '@/lib/commerce/types';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'canceled'],
  processing: ['shipped', 'canceled'],
  shipped: ['completed'],
  completed: [],
  canceled: [],
};

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot move order from "${from}" to "${to}".`);
    this.name = 'InvalidOrderTransitionError';
  }
}
