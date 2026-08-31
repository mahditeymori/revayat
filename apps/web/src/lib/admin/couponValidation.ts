// Pure coupon schema + phone masking, split out of coupons.ts (which pulls in
// 'server-only' + DB) so it's testable without a request/DB context —
// mirrors lib/commerce/checkoutValidation.ts's split.
import { z } from 'zod';

export const couponInput = z.object({
  code: z.string().trim().min(1).toUpperCase(),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().int().positive(),
  maxUsesTotal: z.coerce.number().int().positive().nullable().default(null),
  maxUsesPerCustomer: z.coerce.number().int().positive().default(1),
  minSubtotalRial: z.coerce.number().int().min(0).default(0),
  active: z.coerce.boolean().default(true),
  expiresAt: z
    .string()
    .trim()
    .transform((v) => (v ? new Date(v) : null))
    .nullable()
    .default(null),
  assignedPhone: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .default(null),
});
export type CouponInput = z.infer<typeof couponInput>;

// Masks all but the first 4 and last digit, e.g. 09121234567 -> 0912******7.
export function maskPhone(phone: string): string {
  if (phone.length <= 5) return phone;
  return phone.slice(0, 4) + '*'.repeat(phone.length - 5) + phone.slice(-1);
}
