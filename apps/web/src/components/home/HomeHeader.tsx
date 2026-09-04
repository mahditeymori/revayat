import Link from 'next/link';
import { site, nav } from '@/lib/site';
import { CartTrigger } from '@/components/cart/CartTrigger';
import { MobileNav } from './MobileNav';

// Homepage-only header (see HeaderGate). Same visual family as the shared
// Header() in layout.tsx — that one is untouched and still used everywhere else.
export function HomeHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream/85 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="wordmark text-lg text-ink sm:text-xl" aria-label={site.name}>
          {site.name}
        </Link>
        <nav aria-label="اصلی" className="hidden gap-8 text-sm md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-sand-dark">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/search" className="hidden hover:text-sand-dark md:inline">
            جستجو
          </Link>
          <CartTrigger />
          <MobileNav nav={nav} />
        </div>
      </div>
    </header>
  );
}
