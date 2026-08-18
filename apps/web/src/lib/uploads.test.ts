// Run: npm test   (node --test --experimental-strip-types, no framework)
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { resolveUpload, mimeForExt, UPLOADS_DIR } from './uploads.ts';

test('resolveUpload keeps paths inside the uploads directory', () => {
  const ok = resolveUpload(['damavand', '0-abc.jpg']);
  assert.ok(ok?.startsWith(path.resolve(UPLOADS_DIR)));
});

test('resolveUpload rejects traversal attempts', () => {
  // the route passes URL segments straight through, so this is the trust boundary
  assert.equal(resolveUpload(['..', '..', 'products.json']), null);
  assert.equal(resolveUpload(['damavand', '..', '..', '..', 'etc', 'passwd']), null);
  assert.equal(resolveUpload(['..']), null);
});

test('resolveUpload allows nested product directories', () => {
  assert.ok(resolveUpload(['rostam-gordafarid', '1-xyz.webp']));
});

test('mimeForExt maps known image types and falls back safely', () => {
  assert.equal(mimeForExt('jpg'), 'image/jpeg');
  assert.equal(mimeForExt('png'), 'image/png');
  assert.equal(mimeForExt('webp'), 'image/webp');
  assert.equal(mimeForExt('avif'), 'image/avif');
  // never echo back an attacker-chosen type like text/html
  assert.equal(mimeForExt('html'), 'application/octet-stream');
  assert.equal(mimeForExt(''), 'application/octet-stream');
});
