import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { site, nav } from '@/lib/site';
import { getSettings, safe } from '@/lib/catalog';
import { CartBadge } from '@/components/CartBadge';
import { Track } from '@/components/Track';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: site.locale,
    siteName: site.name,
    title: site.name,
    description: site.description,
    url: site.url,
  },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = {
  themeColor: '#f2ede8',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await safe(getSettings(), null);
  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen flex-col bg-cream text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-cream"
        >
          رفتن به محتوای اصلی
        </a>
        {settings?.announcement && (
          <p className="bg-ink px-4 py-2 text-center text-xs text-cream">{settings.announcement}</p>
        )}
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer footerText={settings?.footerText} />
        <Track />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
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
          <Link href="/search" className="hover:text-sand-dark">
            جستجو
          </Link>
          <Link href="/cart" className="relative hover:text-sand-dark">
            سبد خرید
            <CartBadge />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer({ footerText }: { footerText?: string }) {
  return (
    <footer className="mt-24 border-t border-cream-200 bg-cream-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="wordmark text-base">{site.name}</p>
          <p className="mt-4 max-w-sm text-sm leading-8 text-ink-60">{footerText || site.description}</p>
        </div>
        <nav aria-label="فوتر" className="text-sm">
          <p className="mb-4 font-medium">خرید</p>
          <ul className="space-y-3 text-ink-60">
            {nav.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-ink">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="پشتیبانی" className="text-sm">
          <p className="mb-4 font-medium">پشتیبانی</p>
          <ul className="space-y-3 text-ink-60">
            <li>
              <Link href="/pages/shipping" className="hover:text-ink">
                ارسال و تحویل
              </Link>
            </li>
            <li>
              <Link href="/pages/returns" className="hover:text-ink">
                بازگشت کالا
              </Link>
            </li>
            <li>
              <Link href="/pages/size-guide" className="hover:text-ink">
                راهنمای سایز
              </Link>
            </li>
            <li>
              <Link href="/pages/contact" className="hover:text-ink">
                تماس با ما
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-cream-200 px-4 py-6 text-center text-xs text-ink-60 sm:px-6">
        © {new Date().getFullYear()} {site.name} — تمامی حقوق محفوظ است.
      </div>
    </footer>
  );
}
