'use client';

// Reuses the same brand asset/dependency as the header cart icon — no new
// binary asset, no new dependency added to the bundle. The global
// prefers-reduced-motion rule doesn't reach this WASM-rendered canvas, so it
// subscribes to the media query directly via useSyncExternalStore (the
// server snapshot assumes reduced motion — the SSR-safe default — until the
// client subscribes and reads the real value).
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return true;
}

export function EmptyCartState({ onNavigate }: { onNavigate?: () => void }) {
  const reduceMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="h-20 w-20 opacity-70" aria-hidden>
        <DotLottieReact
          src="/cart-icon.lottie"
          autoplay={!reduceMotion}
          loop={!reduceMotion}
          className="h-20 w-20"
        />
      </div>
      <p className="mt-4 text-sm text-ink-60">سبد خرید شما خالی است.</p>
      <Link
        href="/collections"
        onClick={onNavigate}
        className="mt-6 border border-ink px-6 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
      >
        دیدن مجموعه‌ها
      </Link>
    </div>
  );
}
