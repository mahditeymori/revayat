'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/admin/session';
import { reconcilePayment } from '@/lib/zibal/payment-flow';

// reconcilePayment() itself is idempotent (WHERE-guarded status transition —
// see lib/zibal/payment-flow.ts) and independently re-validates amount and
// settlement against the gateway; this action adds only the permission gate.
export async function inquiryPaymentAction(paymentId: string): Promise<void> {
  await requirePermission('payments.inquiry');
  await reconcilePayment(paymentId);
  revalidatePath(`/admin/payments/${paymentId}`);
}
