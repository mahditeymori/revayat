'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Catches any otherwise-uncaught render/action error under this segment tree.
// Without this, Next falls back to its bare unstyled default error page.
// error.message/digest are logged server-side only — never rendered — since
// they can carry internal detail (query fragments, file paths) that
// shouldn't reach a customer's screen.
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] uncaught render error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="wordmark text-xs text-ink-60">خطا</p>
      <h1 className="mt-6 text-2xl">مشکلی پیش آمد</h1>
      <p className="mt-4 text-sm text-ink-60">لطفاً دوباره تلاش کنید یا به صفحه اصلی بازگردید.</p>
      <div className="mt-10 flex gap-4">
        <button onClick={reset} className="border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
          تلاش دوباره
        </button>
        <Link href="/" className="border border-ink px-8 py-3 text-sm hover:bg-ink hover:text-cream">
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
