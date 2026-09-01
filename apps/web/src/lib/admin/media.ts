import 'server-only';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { mediaAssets } from '@/db/schema';
import { localMediaStorage } from '@/lib/media/local-storage';
import { sniffImageType } from './imageSniff';

const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadMediaFile(file: File) {
  if (file.size > MAX_BYTES) throw new Error('حجم فایل بیش از حد مجاز (۵ مگابایت) است.');

  const data = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not file.type — a fetch() caller can label any content
  // as "image/jpeg". The sniffed type also becomes the stored mimeType, so
  // the /api/uploads route can never be tricked into serving a mismatched
  // Content-Type for whatever was actually uploaded.
  const detected = sniffImageType(data);
  if (!detected) throw new Error('نوع فایل مجاز نیست. فقط JPEG، PNG، WebP یا AVIF.');

  const key = `products/${randomUUID()}.${detected.ext}`;
  const stored = await localMediaStorage.put({ key, data, contentType: detected.type });

  const [row] = await db
    .insert(mediaAssets)
    .values({ storageKey: stored.storageKey, url: stored.url, mimeType: detected.type, sizeBytes: file.size })
    .returning();
  return row;
}

// Used by app/api/uploads/[...path]/route.ts to resolve a requested key back
// to its stored MIME type — kept here so that route stays outside the
// app/-may-not-touch-drizzle-directly boundary enforced by eslint.config.mjs.
export async function getMediaAssetByKey(storageKey: string) {
  return db.query.mediaAssets.findFirst({ where: eq(mediaAssets.storageKey, storageKey) });
}
