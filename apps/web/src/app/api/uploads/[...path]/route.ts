import { NextResponse } from 'next/server';
import { getMediaAssetByKey } from '@/lib/admin/media';
import { localMediaStorage } from '@/lib/media/local-storage';

// Public and unauthenticated on purpose: these are product/storefront images
// rendered in plain <img> tags, not admin-only data. Path traversal is
// guarded inside localMediaStorage itself (assertSafeKey), and the key must
// match a row we created via the admin upload action, so this never serves
// arbitrary files off disk.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const storageKey = segments.join('/');

  const asset = await getMediaAssetByKey(storageKey);
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const data = await localMediaStorage.get(storageKey).catch(() => null);
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
