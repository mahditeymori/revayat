import 'server-only';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { mediaAssets } from '@/db/schema';
import { localMediaStorage } from '@/lib/media/local-storage';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadMediaFile(file: File) {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error('نوع فایل مجاز نیست. فقط JPEG، PNG، WebP یا AVIF.');
  if (file.size > MAX_BYTES) throw new Error('حجم فایل بیش از حد مجاز (۵ مگابایت) است.');

  const data = Buffer.from(await file.arrayBuffer());
  const key = `products/${randomUUID()}.${ext}`;
  const stored = await localMediaStorage.put({ key, data, contentType: file.type });

  const [row] = await db
    .insert(mediaAssets)
    .values({ storageKey: stored.storageKey, url: stored.url, mimeType: file.type, sizeBytes: file.size })
    .returning();
  return row;
}

// Used by app/api/uploads/[...path]/route.ts to resolve a requested key back
// to its stored MIME type — kept here so that route stays outside the
// app/-may-not-touch-drizzle-directly boundary enforced by eslint.config.mjs.
export async function getMediaAssetByKey(storageKey: string) {
  return db.query.mediaAssets.findFirst({ where: eq(mediaAssets.storageKey, storageKey) });
}
