'use client';

import Link from 'next/link';
import { useState } from 'react';

export function MobileNav({ nav }: { nav: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="منو"
        className="flex h-8 w-8 items-center justify-center"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-b border-cream-200 bg-cream md:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block border-b border-cream-200 px-4 py-4 text-sm"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/search" onClick={() => setOpen(false)} className="block px-4 py-4 text-sm">
            جستجو
          </Link>
        </div>
      )}
    </div>
  );
}
