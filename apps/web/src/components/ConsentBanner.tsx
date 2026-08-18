'use client';

// Cookie banner. Renders only when `_rc` is absent, and only after mount —
// the layout is a server component, so rendering it during SSR would bake the
// banner into the static HTML of every cached page and show it to people who
// already answered.
// `consent` comes from Track rather than lib/analytics: that module opens `fs`
// at the top level and must not reach the browser bundle.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { consent } from '@/components/Track';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consent()) setVisible(true);
  }, []);

  async function answer(decision: 'yes' | 'no') {
    // Hide immediately — the visitor's click should never wait on the network.
    setVisible(false);
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
      keepalive: true,
    }).catch(() => {});
    // Tell <Track /> the answer changed, so an accepted visitor's current page
    // is counted instead of being lost until the next navigation.
    window.dispatchEvent(new CustomEvent('consent:set', { detail: decision }));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-200 bg-cream-50 p-4 shadow-[0_-1px_12px_rgba(19,17,16,0.06)] sm:p-5"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-2xl">
          <p id="consent-title" className="text-sm font-medium">
            کوکی‌های آماری
          </p>
          <p className="mt-1 text-xs leading-6 text-ink-60">
            برای اینکه بدانیم کدام صفحه‌ها بیشتر دیده می‌شوند و سایت را بهتر کنیم، از کوکی‌های
            آماری خودمان استفاده می‌کنیم. هیچ سرویس تبلیغاتی یا ردیاب بیرونی در کار نیست و
            اطلاعات شخصی شما ذخیره نمی‌شود.{' '}
            <Link href="/pages/privacy" className="underline hover:text-ink">
              جزئیات بیشتر
            </Link>
          </p>
        </div>
        {/* flex-1 on mobile so the long Persian label cannot squeeze Accept to
            a sliver; shrink-0 + auto width once there is room on one row. */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => answer('no')}
            className="flex-1 border border-cream-200 px-4 py-3 text-xs transition-colors hover:border-ink sm:flex-none sm:px-5"
          >
            بدون آمار ادامه بده
          </button>
          <button
            type="button"
            onClick={() => answer('yes')}
            className="flex-1 bg-ink px-4 py-3 text-xs text-cream transition-colors hover:bg-sand-dark sm:flex-none sm:px-5"
          >
            قبول می‌کنم
          </button>
        </div>
      </div>
    </div>
  );
}
