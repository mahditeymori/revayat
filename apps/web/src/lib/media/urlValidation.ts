// Shared safe-media-URL check, used by every admin schema with a free-text
// image URL field (categories, site settings). Split out so the rule lives
// in one place instead of being re-implemented per schema.
//
// Accepts:
//  - a same-origin upload path served by app/api/uploads/[...path]/route.ts
//    (see lib/media/local-storage.ts's getUrl) — e.g. "/api/uploads/categories/x.webp"
//  - an absolute http(s) URL, for legitimately hotlinked images
// Rejects everything else, in particular javascript:, data:, file:, and any
// other scheme that could execute or read local content when rendered.
import { z } from 'zod';

const UPLOAD_PATH_PREFIX = '/api/uploads/';

export function isSafeMediaUrl(value: string): boolean {
  if (value.startsWith(UPLOAD_PATH_PREFIX)) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Trims to null on empty (so clearing the field in a form works), then
// requires whatever remains to pass isSafeMediaUrl.
export const safeMediaUrl = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .default(null)
  .refine((v) => v === null || isSafeMediaUrl(v), 'آدرس تصویر نامعتبر است.');
