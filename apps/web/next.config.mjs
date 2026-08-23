/** @type {import('next').NextConfig} */

// Persian-heritage brand storefront, fully self-contained: local JSON catalog,
// local images, self-hosted fonts. CSP is intentionally strict — the payment
// gateway is the only third-party origin, and only as a navigation target.
//
// The checkout form POSTs to a server action that redirects to Zibal. Browsers
// enforce form-action against the *final* URL of a form submission, so without
// the gateway listed here that redirect is blocked and the customer never
// reaches the bank. It is a navigation target only: no Zibal script, style,
// image, frame or XHR is allowed by any other directive.
const ZIBAL_GATEWAY = 'https://gateway.zibal.ir';

// The Enamad trust seal (Iranian e-commerce) must be served unmodified from
// Enamad's own host — proxying or re-encoding it invalidates the seal. Without
// it in img-src the badge is silently blocked and the shop shows no trust mark
// at all, which for an Iranian storefront costs real conversions. Image origin
// only; no script or frame from that host is permitted.
const ENAMAD = 'https://trustseal.enamad.ir';
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${ENAMAD}`,
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  `form-action 'self' ${ZIBAL_GATEWAY}`,
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/products/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
