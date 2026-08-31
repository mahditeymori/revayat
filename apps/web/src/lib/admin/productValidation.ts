// Pure product/variant schemas + duplicate-variant check, split out of
// products.ts (which pulls in 'server-only' + DB) so it's testable without a
// request/DB context — mirrors lib/commerce/checkoutValidation.ts's split.
import { z } from 'zod';

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  size: z.string().trim().max(50).nullable().default(null),
  color: z.string().trim().max(50).nullable().default(null),
  sku: z.string().trim().max(100).nullable().default(null),
  priceRial: z.coerce.number().int().positive().nullable().default(null),
  compareAtPriceRial: z.coerce.number().int().positive().nullable().default(null),
  stock: z.coerce.number().int().min(0).default(0),
  active: z.coerce.boolean().default(true),
});

export const productInput = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, 'اسلاگ باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد'),
  name: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).default(''),
  description: z.string().trim().max(10000).default(''),
  priceRial: z.coerce.number().int().positive(),
  salePriceRial: z.coerce.number().int().positive().nullable().default(null),
  categoryId: z.string().uuid().nullable().default(null),
  featured: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
  variants: z.array(variantInput).min(1, 'حداقل یک تنوع لازم است'),
});

export type ProductInput = z.infer<typeof productInput>;

export function assertNoDuplicateVariants(variants: ProductInput['variants']) {
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.size ?? ''}::${v.color ?? ''}`;
    if (seen.has(key)) throw new Error(`ترکیب تکراری تنوع: سایز «${v.size ?? '-'}» رنگ «${v.color ?? '-'}»`);
    seen.add(key);
  }
}
