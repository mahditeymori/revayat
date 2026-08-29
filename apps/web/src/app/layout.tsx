import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { site, nav } from '@/lib/site';
import { getSettings, getSupportContent, safe } from '@/lib/catalog';
import { DEFAULT_SUPPORT_CONTENT } from '@/lib/faq';
import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartTrigger } from '@/components/cart/CartTrigger';
import { Track } from '@/components/Track';
import { ConsentBanner } from '@/components/ConsentBanner';
import { SupportWidget } from '@/components/SupportWidget';
import { EnamadBadge } from '@/components/EnamadBadge';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.nameFa} | ${site.tagline}`, template: `%s | ${site.nameFa}` },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: site.locale,
    siteName: site.nameFa,
    title: `${site.nameFa} | ${site.tagline}`,
    description: site.description,
    url: site.url,
    images: [{ url: site.logo, width: 1254, height: 1254, alt: site.nameFa }],
  },
  twitter: {
    card: 'summary',
    title: `${site.nameFa} | ${site.tagline}`,
    description: site.description,
    images: [site.logo],
  },
  icons: { icon: '/icon.jpg', shortcut: '/icon.jpg', apple: '/icon.jpg' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = {
  themeColor: '#f2ede8',
  width: 'device-width',
  initialScale: 1,
};

// Organization + WebSite schema, rendered on every page. This is what tells
// Google "روایت شاپ" (the Persian brand name) and "REVAYAT" (the wordmark)
// both refer to this same site/entity — Organization.name carries the brand,
// alternateName covers the Latin form, and WebSite ties both to site.url.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.nameFa,
  alternateName: site.name,
  url: site.url,
  logo: `${site.url}${site.logo}`,
  description: site.description,
  sameAs: [site.socials.instagram],
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.nameFa,
  alternateName: site.name,
  url: site.url,
  inLanguage: 'fa-IR',
  publisher: { '@type': 'Organization', name: site.nameFa },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await safe(getSettings(), null);
  const supportContent = await safe(getSupportContent(), DEFAULT_SUPPORT_CONTENT);
  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen flex-col bg-cream text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <CartProvider>
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
          <ConsentBanner />
          <SupportWidget content={supportContent} />
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

function Footer({ footerText }: { footerText?: string }) {
  return (
    <footer className="mt-24 border-t border-cream-200 bg-cream-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="wordmark text-base">{site.name}</p>
          <p className="mt-4 max-w-sm text-sm leading-8 text-ink-60">
            {footerText || site.description}
          </p>
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
            <li>
              <Link href="/pages/privacy" className="hover:text-ink">
                حریم خصوصی
              </Link>
            </li>
          </ul>
        </nav>

        {/* Enamad کنار خرید و پشتیبانی */}
        <div className="text-sm">
          <p className="mb-4 font-medium">اعتماد</p>
          <EnamadBadge size={72} />
        </div>
      </div>

      <div className="border-t border-cream-200 px-4 py-6 text-center text-xs text-ink-60 sm:px-6">
        © {new Date().getFullYear()} {site.name} — تمامی حقوق محفوظ است.
      </div>
    </footer>
  );
}