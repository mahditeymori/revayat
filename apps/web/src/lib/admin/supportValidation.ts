// Pure support-page/FAQ schemas, split out of support.ts (which pulls in
// 'server-only' + DB) so it's testable without a request/DB context —
// mirrors lib/commerce/checkoutValidation.ts's split.
import { z } from 'zod';

export const supportPageInput = z.object({
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, 'اسلاگ باید انگلیسی باشد.'),
  title: z.string().trim().min(1).max(200),
  bodyHtml: z.string().trim().default(''),
});
export type SupportPageInput = z.infer<typeof supportPageInput>;

export const faqInput = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000),
  sortOrder: z.coerce.number().int().default(0),
});
export type FaqInput = z.infer<typeof faqInput>;
