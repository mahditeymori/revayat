// UNIT VERIFIED — pure byte-signature matching, no DB/network.
import { describe, expect, it } from 'vitest';
import { sniffImageType } from './imageSniff';

describe('sniffImageType', () => {
  it('detects a JPEG from its FF D8 FF signature', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageType(buf)).toEqual({ type: 'image/jpeg', ext: 'jpg' });
  });

  it('detects a PNG from its 8-byte signature', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffImageType(buf)).toEqual({ type: 'image/png', ext: 'png' });
  });

  it('detects a WEBP from its RIFF....WEBP container', () => {
    const buf = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP', 'ascii')]);
    expect(sniffImageType(buf)).toEqual({ type: 'image/webp', ext: 'webp' });
  });

  it('detects an AVIF from its ftyp box with an avif/avis brand', () => {
    const buf = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('ftyp', 'ascii'), Buffer.from('avif', 'ascii')]);
    expect(sniffImageType(buf)).toEqual({ type: 'image/avif', ext: 'avif' });
  });

  it('rejects an HTML/script payload disguised with a forged Content-Type', () => {
    const buf = Buffer.from('<script>alert(1)</script>', 'utf-8');
    expect(sniffImageType(buf)).toBeNull();
  });

  it('rejects a PDF (real bytes, wrong signature) even though PDFs are sometimes image-adjacent', () => {
    const buf = Buffer.from('%PDF-1.4\n', 'utf-8');
    expect(sniffImageType(buf)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a RIFF container that is not WEBP (e.g. a WAV file)', () => {
    const buf = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE', 'ascii')]);
    expect(sniffImageType(buf)).toBeNull();
  });
});
