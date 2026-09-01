'use client';

import { useEffect } from 'react';

// Last-resort boundary: only fires when the root layout itself throws, so it
// must render its own <html>/<body> and cannot assume layout.tsx's CSS/fonts
// loaded — inline styles only. error.tsx (renders inside the layout, keeps
// normal styling) handles every other case.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[app] uncaught root error', error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>مشکلی پیش آمد</h1>
        <p>لطفاً صفحه را دوباره بارگذاری کنید.</p>
      </body>
    </html>
  );
}
