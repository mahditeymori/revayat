// One-off: attach prepared category photos (repo-root picture/) to the three
// clothing categories, via the same storage + mediaAssets path uploadMediaFile
// uses (apps/web/src/lib/admin/media.ts) — not a separate image system.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema.ts';
import { sniffImageType } from '../src/lib/admin/imageSniff.ts';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });
const { categories, mediaAssets } = schema;

const uploadsDir = path.resolve(process.env.MEDIA_UPLOADS_DIR ?? './uploads');
const repoRoot = path.resolve(import.meta.dirname, '../../..');

const ASSIGNMENTS = [
  { slug: 'tishirt', file: path.join(repoRoot, 'picture/tshirt-category-v3.jpg') },
  { slug: 'hoodie', file: path.join(repoRoot, 'picture/hoodie-category-v2.jpg') },
  { slug: 'sweatshirt', file: path.join(repoRoot, 'picture/doros-category-v2.jpg') },
];

for (const { slug, file } of ASSIGNMENTS) {
  const data = await readFile(file);
  const detected = sniffImageType(data);
  if (!detected) throw new Error(`${file}: not a recognized image format`);

  const key = `products/${randomUUID()}.${detected.ext}`;
  await mkdir(path.dirname(path.join(uploadsDir, key)), { recursive: true });
  await writeFile(path.join(uploadsDir, key), data);
  const url = `/api/uploads/${key}`;

  const [asset] = await db
    .insert(mediaAssets)
    .values({ storageKey: key, url, mimeType: detected.type, sizeBytes: data.byteLength })
    .returning();

  const [updated] = await db.update(categories).set({ imageUrl: asset.url }).where(eq(categories.slug, slug)).returning();
  if (!updated) throw new Error(`category slug not found: ${slug}`);
  console.log(`[attach-category-images] ${slug} -> ${asset.url}`);
}

await client.end();
