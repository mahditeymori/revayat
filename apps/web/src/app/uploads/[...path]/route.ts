// Serves admin-uploaded product images out of DATA_DIR. next/image optimizes
// these like any other same-origin image, so no CSP change is needed.
import { promises as fs } from 'fs';
import path from 'path';
import { resolveUpload, mimeForExt } from '@/lib/uploads';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const file = resolveUpload(segments);
  if (!file) return new Response('Not found', { status: 404 });

  try {
    const body = await fs.readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': mimeForExt(path.extname(file).slice(1)),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
