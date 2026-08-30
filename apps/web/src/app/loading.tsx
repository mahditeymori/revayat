// Shown while a route segment streams in. Next renders this instantly on
// navigation, so it doubles as the startup animation without blocking paint
// behind a fake splash screen.
export default function Loading() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <span className="wordmark animate-brand-pulse text-2xl text-ink">REVAYAT</span>
        <span className="h-px w-24 overflow-hidden bg-cream-200">
          <span className="block h-full w-1/3 animate-brand-sweep bg-ink" />
        </span>
        <span className="sr-only">در حال بارگذاری…</span>
      </div>
    </div>
  );
}
