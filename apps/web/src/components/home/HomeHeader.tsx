import Link from 'next/link';
import { site, nav } from '@/lib/site';
import { CartTrigger } from '@/components/cart/CartTrigger';
import { MobileNav } from './MobileNav';

// Homepage-only header (see HeaderGate). Same visual family as the shared
// Header() in layout.tsx — that one is untouched and still used everywhere else.
export function HomeHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream/90 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6">
        <Link href="/" className="wordmark text-xl tracking-wide text-ink sm:text-2xl" aria-label={site.name}>
          {site.name}
        </Link>
        <nav aria-label="اصلی" className="hidden gap-9 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-transparent pb-1 transition-colors hover:border-sand-dark hover:text-sand-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/search" aria-label="جستجو" className="hidden hover:text-sand-dark md:inline-flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
          </Link>
          <CartTrigger />
          <MobileNav nav={nav} />
        </div>
      </div>
    </header>
  );
}
