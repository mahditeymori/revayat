// Shared fixture constants for e2e/global-setup.ts and all e2e/*.spec.ts files.
// Test-only data seeded into whatever DATABASE_URL points at when running
// `npm run test:e2e` — not production credentials, not committed secrets.
export const FIXTURES = {
  categorySlug: 'e2e-test-category',
  categoryName: 'دسته تست E2E',
  productSlug: 'e2e-test-product',
  productName: 'محصول تست E2E',
  priceRial: 1_000_000,
  variantSizes: ['S', 'M'] as const,
  couponCode: 'E2ETESTCOUPON',
  couponValueRial: 50_000,
  adminEmail: 'e2e-admin@test.local',
  adminPassword: 'E2eTestPass!234',
  orderCartToken: 'e2e-fixture-order-cart-token',
  shippingName: 'کاربر تست',
  shippingPhone: '09123456789',
  shippingPostalCode: '1234567890',
  shippingAddress: 'تهران، خیابان تست، پلاک ۱',
} as const;
