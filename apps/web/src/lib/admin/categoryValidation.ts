// Pure category schema, split out of categories.ts (which pulls in
// 'server-only' + DB) so it's testable without a request/DB context —
// mirrors lib/commerce/checkoutValidation.ts's split.
import { z } from 'zod';
import { safeMediaUrl } from '@/lib/media/urlValidation';

export const categoryInput = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, 'اسلاگ باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد'),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  imageUrl: safeMediaUrl,
  sortOrder: z.coerce.number().int().default(0),
});

export type CategoryInput = z.infer<typeof categoryInput>;
