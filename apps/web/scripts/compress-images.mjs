#!/usr/bin/env node
// Shrink product images in place. Run: node scripts/compress-images.mjs [--apply]
//
// Safety contract — this is why it does NOT convert to WebP/AVIF:
// every file keeps its exact path, filename and extension, so products.json,
// admin uploads and every rendered <img src> keep working untouched. The only
// change is fewer bytes behind the same URL.
//
// Visitors already receive AVIF/WebP because next/image re-encodes on the fly;
// these originals are the *source* it optimizes from. Oversized sources cost
// repo size, Docker image size, backup size and optimizer CPU — not visitor
// bandwidth. 2000px is well above what any layout here requests.
//
// sharp is already installed as a Next.js dependency — nothing new to add.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, 'data');

const TARGETS = [path.join(ROOT, 'public', 'products'), path.join(DATA_DIR, 'uploads')];
const MAX_EDGE = 2000;
const QUALITY = 82;
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const apply = process.argv.includes('--apply');
const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (EXTS.has(path.extname(e.name).toLowerCase())) yield full;
  }
}

/** Re-encode to the SAME format. Anything else would change the file's URL. */
function encode(pipeline, ext) {
  switch (ext) {
    case '.png':
      // effort 9 + palette: the biggest win on flat/graphic PNGs, lossless-ish
      // on photos. Photographic PNGs stay large — that is inherent to PNG, and
      // converting them would rename the file.
      return pipeline.png({ compressionLevel: 9, effort: 10, palette: true });
    case '.webp':
      return pipeline.webp({ quality: QUALITY, effort: 6 });
    case '.avif':
      return pipeline.avif({ quality: QUALITY - 10, effort: 6 });
    default:
      return pipeline.jpeg({ quality: QUALITY, mozjpeg: true, progressive: true });
  }
}

let before = 0;
let after = 0;
let touched = 0;
let skipped = 0;

for (const dir of TARGETS) {
  for await (const file of walk(dir)) {
    const orig = (await fs.stat(file)).size;
    const ext = path.extname(file).toLowerCase();

    let out;
    try {
      const meta = await sharp(file).metadata();
      const tooBig = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE;
      out = await encode(
        // rotate() first: applies the EXIF orientation, which is dropped along
        // with the rest of the metadata (and with it any GPS coordinates).
        tooBig
          ? sharp(file).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside' })
          : sharp(file).rotate(),
        ext,
      ).toBuffer();
    } catch (err) {
      console.error(`SKIP  ${path.relative(ROOT, file)} — ${err.message}`);
      skipped++;
      continue;
    }

    before += orig;
    // Never write a bigger file. Already-optimized images are left exactly alone.
    if (out.length >= orig) {
      after += orig;
      skipped++;
      continue;
    }
    after += out.length;
    touched++;
    console.log(
      `${apply ? 'WROTE' : 'would'} ${path.relative(ROOT, file)}  ${mb(orig)} → ${mb(out.length)}`,
    );

    if (apply) {
      // Write beside the target, then rename: a crash mid-write can never leave
      // a truncated image where a working one used to be.
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, out);
      await fs.rename(tmp, file);
    }
  }
}

console.log(
  `\n${touched} file(s) shrink, ${skipped} left as-is.  ${mb(before)} → ${mb(after)}` +
    (apply ? '' : '\nDry run — nothing written. Re-run with --apply.'),
);
