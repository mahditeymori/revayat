// Product images live in DATA_DIR (the Docker volume), not public/, so admin
// uploads survive image rebuilds. Served back through app/uploads/[...path].
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const MAX_BYTES = 5 * 1024 * 1024;

// Content-sniffed rather than trusting the browser's Content-Type or the
// filename — both are attacker-controlled on an upload endpoint.
const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b: Buffer) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    ext: 'avif',
    mime: 'image/avif',
    test: (b: Buffer) => b.subarray(4, 8).toString('ascii') === 'ftyp' && b.subarray(8, 12).toString('ascii').startsWith('avif'),
  },
] as const;

export const mimeForExt = (ext: string): string =>
  SIGNATURES.find((s) => s.ext === ext)?.mime ?? 'application/octet-stream';

/** Resolve a request path inside UPLOADS_DIR, or null if it escapes. */
export function resolveUpload(segments: string[]): string | null {
  const full = path.resolve(UPLOADS_DIR, ...segments);
  const root = path.resolve(UPLOADS_DIR);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Persist one uploaded image under uploads/<slug>/ and return its public URL.
 * Filenames are generated, never taken from the client.
 */
export async function saveUpload(file: File, slug: string, index: number): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: 'فایل خالی است.' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'حجم تصویر باید کمتر از ۵ مگابایت باشد.' };

  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) return { ok: false, error: 'فقط JPG، PNG، WebP و AVIF پذیرفته می‌شود.' };

  const dir = path.join(UPLOADS_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  // index + size keeps names stable-ish per upload without needing a DB counter
  const name = `${index}-${buf.length.toString(36)}.${sig.ext}`;
  const tmp = path.join(dir, `${name}.tmp`);
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, path.join(dir, name));

  return { ok: true, url: `/uploads/${slug}/${name}` };
}

/** Best-effort cleanup — a missing file must not fail the product delete. */
export async function deleteUploadDir(slug: string): Promise<void> {
  await fs.rm(path.join(UPLOADS_DIR, slug), { recursive: true, force: true }).catch(() => {});
}
