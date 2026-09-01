// Detects an image's real type from its magic bytes rather than trusting the
// client-supplied File.type — a fetch() caller can set that field to anything
// regardless of actual content, and mediaAssets.mimeType (this value) becomes
// the Content-Type the /api/uploads route later serves the file back with.
// No image-processing library needed: these four formats' signatures are a
// handful of fixed bytes each.
const SIGNATURES: { type: string; ext: string; matches: (buf: Buffer) => boolean }[] = [
  { type: 'image/jpeg', ext: 'jpg', matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    ext: 'png',
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    type: 'image/webp',
    ext: 'webp',
    matches: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    type: 'image/avif',
    ext: 'avif',
    matches: (b) => {
      if (b.length < 12 || b.toString('ascii', 4, 8) !== 'ftyp') return false;
      const brand = b.toString('ascii', 8, 12);
      return brand === 'avif' || brand === 'avis';
    },
  },
];

export function sniffImageType(buffer: Buffer): { type: string; ext: string } | null {
  const hit = SIGNATURES.find((s) => s.matches(buffer));
  return hit ? { type: hit.type, ext: hit.ext } : null;
}
