import 'server-only';

export type StoredFile = {
  storageKey: string;
  url: string;
};

// Storage-backend abstraction: local-storage.ts implements this against the
// disk volume today; a future object-storage/CDN backend (S3-compatible)
// implements the same interface, so callers (admin upload actions,
// lib/commerce/*) never change.
export interface MediaStorage {
  put(input: { key: string; data: Buffer; contentType: string }): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}
