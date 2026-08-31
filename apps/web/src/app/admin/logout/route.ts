// POST-only (not GET) so logout is never triggerable by a bare link/prefetch.
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/admin/session';

export async function POST(req: Request): Promise<NextResponse> {
  await destroySession();
  return NextResponse.redirect(new URL('/admin/login', req.url), 303);
}
