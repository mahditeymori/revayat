import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MediaStorage, StoredFile } from './storage';

// Writes into MEDIA_UPLOADS_DIR, which in production is a Docker volume
// (see docker-compose.yml's `revayat_uploads`) so uploads survive container
// replacement. Served back out via app/api/uploads/[...path]/route.ts — the
// key never doubles as a public/ path, so swapping this implementation for
// an object-storage backend later never touches the URL shape callers see.
const uploadsDir = path.resolve(process.env.MEDIA_UPLOADS_DIR ?? './uploads');

function assertSafeKey(key: string) {
  const resolved = path.resolve(uploadsDir, key);
  if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + path.sep)) {
    throw new Error(`Refusing to access media key outside uploads dir: ${key}`);
  }
  return resolved;
}

export const localMediaStorage: MediaStorage = {
  async put({ key, data }): Promise<StoredFile> {
    const dest = assertSafeKey(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
    return { storageKey: key, url: localMediaStorage.getUrl(key) };
  },

  async get(key) {
    return readFile(assertSafeKey(key));
  },

  getUrl(key) {
    return `/api/uploads/${key}`;
  },

  async delete(key) {
    const dest = assertSafeKey(key);
    await unlink(dest).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  },
};
