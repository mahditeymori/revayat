// Pure site-settings schema, split out of settings.ts (which pulls in
// 'server-only' + DB) so it's testable without a request/DB context —
// mirrors lib/commerce/checkoutValidation.ts's split.
import { z } from 'zod';

export const settingsInput = z.object({
  announcement: z.string().trim().max(300).default(''),
  heroTitle: z.string().trim().max(200).default(''),
  heroSubtitle: z.string().trim().max(300).default(''),
  heroImageUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .default(null),
  footerText: z.string().trim().max(500).default(''),
});
export type SettingsInput = z.infer<typeof settingsInput>;
