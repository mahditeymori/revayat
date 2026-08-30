import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { site, nav } from '@/lib/site';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/json-ld';
import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartTrigger } from '@/components/cart/CartTrigger';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nameFa} | ${site.nameEn}`,
    template: `%s | ${site.nameFa}`,
  },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: site.locale,
    siteName: site.nameFa,
    title: `${site.nameFa} | ${site.nameEn}`,
    description: site.description,
    url: site.url,
    images: [{ url: site.logo, width: 1254, height: 1254, alt: site.nameFa }],
  },
  twitter: {
    card: 'summary',
    title: `${site.nameFa} | ${site.nameEn}`,
    description: site.description,
    images: [site.logo],
  },
  icons: { icon: '/icon.jpg', shortcut: '/icon.jpg', apple: '/icon.jpg' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = {
  themeColor: '#f5f1ea',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen flex-col bg-cream text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-cream"
        >
          رفتن به محتوای اصلی
        </a>
        <CartProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </CartProvider>
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
          <CartTrigger />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-cream-200 bg-cream-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="wordmark text-base">{site.name}</p>
          <p className="mt-4 max-w-sm text-sm leading-8 text-ink-60">{site.description}</p>
        </div>

        <nav aria-label="فوتر" className="text-sm">
          <p className="mb-4 font-medium">خرید</p>
          <ul className="space-y-3 text-ink-60">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="درباره" className="text-sm">
          <p className="mb-4 font-medium">درباره ما</p>
          <ul className="space-y-3 text-ink-60">
            <li>
              <a
                href={site.socials.instagram}
                rel="noopener noreferrer"
                target="_blank"
                className="hover:text-ink"
              >
                اینستاگرام
              </a>
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
