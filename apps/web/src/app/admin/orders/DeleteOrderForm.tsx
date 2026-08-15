'use client';

import { deleteOrderAction } from '../actions';

export function DeleteOrderForm({ orderId }: { orderId: number }) {
  return (
    <form
      action={deleteOrderAction}
      onSubmit={(e) => {
        if (!confirm('این سفارش برای همیشه حذف می‌شود. مطمئن هستید؟')) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={orderId} />
      <button
        type="submit"
        className="border border-clay px-4 py-2 text-xs text-clay hover:bg-clay hover:text-cream"
      >
        حذف
      </button>
    </form>
  );
}
