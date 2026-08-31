import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const adminRoleEnum = pgEnum('admin_role', ['owner', 'admin', 'editor', 'support']);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'processing',
  'shipped',
  'completed',
  'canceled',
]);

// Aggregate, derived from this order's `payments` rows by the payment-flow
// domain logic — never written directly by request handlers. Kept fully
// independent of `orders.status` (fulfillment), per the explicit rule that
// OrderStatus and PaymentStatus must never be conflated.
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'failed']);

export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', [
  'pending',
  'succeeded',
  'failed',
  'canceled',
]);

export const reservationStatusEnum = pgEnum('reservation_status', [
  'reserved',
  'confirmed',
  'released',
]);

export const couponTypeEnum = pgEnum('coupon_type', ['percentage', 'fixed']);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  // Archived (not active) categories drop out of storefront listings but are
  // never hard-deleted while products still reference them — admin uses this
  // instead of a real DELETE so a category with live products can be safely
  // retired without corrupting products.category_id (which is ON DELETE SET
  // NULL and would otherwise silently orphan them).
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    description: text('description').notNull().default(''),
    priceRial: integer('price_rial').notNull(),
    salePriceRial: integer('sale_price_rial'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    featured: boolean('featured').notNull().default(false),
    active: boolean('active').notNull().default(true),
    // Populated by lib/search/normalize.ts: canonicalizes ي->ی, ك->ک, strips
    // half-space/diacritics, converts Persian/Arabic digits to ASCII. Both the
    // tsvector and pg_trgm indexes below are built over THIS column, never the
    // raw `name`/`description`, since Persian morphology defeats plain tsvector
    // and raw trigram matching is too noisy without normalization first.
    normalizedSearchText: text('normalized_search_text').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`to_tsvector('simple', "normalized_search_text")`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('products_category_id_idx').on(table.categoryId),
    index('products_search_vector_gin').using('gin', table.searchVector),
    index('products_normalized_search_trgm_gin').using(
      'gin',
      sql`${table.normalizedSearchText} gin_trgm_ops`,
    ),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // Nullable: most images are product-level. Set only when a color/variant
    // has a dedicated photo (Shopify-style variant imagery) — falls back to
    // the product's own images otherwise.
    variantId: uuid('variant_id').references((): typeof productVariants.id => productVariants.id, {
      onDelete: 'set null',
    }),
    url: text('url').notNull(),
    altText: text('alt_text').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('product_images_product_id_idx').on(table.productId),
    index('product_images_variant_id_idx').on(table.variantId),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    size: text('size'),
    color: text('color'),
    // Overrides products.price_rial when set; otherwise the product's base
    // price applies. compareAtPriceRial lets a variant show its own
    // strike-through price independent of products.sale_price_rial.
    priceRial: integer('price_rial'),
    compareAtPriceRial: integer('compare_at_price_rial'),
    // Physical on-hand count. Available-to-sell is ALWAYS computed as
    // stock - Σ(active inventory_reservations for this variant) — see
    // lib/commerce/inventory.ts. Never decremented directly by order creation.
    stock: integer('stock').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('product_variants_product_id_idx').on(table.productId),
    uniqueIndex('product_variants_sku_uidx').on(table.sku).where(sql`${table.sku} is not null`),
  ],
);

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

// The cartToken cookie is the ONLY thing ever stored client-side for cart
// state: an opaque, httpOnly, signed random token pointing at this row. No
// item count, prices, or variant data are ever stored in a cookie.
export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('cart_items_cart_variant_uidx').on(table.cartId, table.variantId)],
);

// ---------------------------------------------------------------------------
// Customers / Orders
// ---------------------------------------------------------------------------

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    phone: text('phone').notNull().unique(),
    fullName: text('full_name').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const orders = pgTable(
  'orders',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    cartToken: text('cart_token').notNull(),
    // Fulfillment lifecycle — fully independent of paymentStatus.
    status: orderStatusEnum('status').notNull().default('pending'),
    // Aggregate derived from this order's payments; written only by
    // lib/zibal/payment-flow.ts, never by request handlers directly.
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
    shippingName: text('shipping_name').notNull(),
    shippingPhone: text('shipping_phone').notNull(),
    shippingAddress: text('shipping_address').notNull(),
    shippingPostalCode: text('shipping_postal_code').notNull(),
    subtotalRial: integer('subtotal_rial').notNull(),
    discountRial: integer('discount_rial').notNull().default(0),
    shippingRial: integer('shipping_rial').notNull().default(0),
    totalRial: integer('total_rial').notNull(),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_cart_token_idx').on(table.cartToken),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: bigserial('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    // Snapshots: frozen at purchase time, never re-resolved against live
    // catalog data — a later price/name change must not alter past orders.
    productName: text('product_name').notNull(),
    variantTitle: text('variant_title').notNull().default(''),
    unitPriceRial: integer('unit_price_rial').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [index('order_items_order_id_idx').on(table.orderId)],
);

// One row per stock hold, mirroring coupon_usages' state machine exactly.
// createOrder reserves stock for every line in the same transaction that
// inserts the order; settlePayment confirms all of an order's reservations on
// `paid`, releases them on `failed`/`canceled`, and a periodic sweep
// (scripts/release-expired-reservations.ts) releases anything still `reserved`
// past expiresAt so an abandoned Zibal redirect doesn't hold stock forever.
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    orderId: bigserial('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').notNull().default('reserved'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('inventory_reservations_order_variant_uidx').on(table.orderId, table.variantId),
    index('inventory_reservations_variant_status_idx').on(table.variantId, table.status),
    index('inventory_reservations_expires_at_idx').on(table.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// Payments (Zibal) — Order 1:N Payments, one row per gateway attempt
// ---------------------------------------------------------------------------

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: bigserial('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // Unique per payment attempt — every retry creates a brand-new row with
    // its own trackId, never reuses one.
    trackId: text('track_id').unique(),
    amountRial: integer('amount_rial').notNull(),
    status: paymentAttemptStatusEnum('status').notNull().default('pending'),
    gatewayRefNumber: text('gateway_ref_number'),
    gatewayCardNumber: text('gateway_card_number'),
    gatewayRawResult: integer('gateway_raw_result'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payments_order_id_idx').on(table.orderId)],
);

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  type: couponTypeEnum('type').notNull(),
  value: integer('value').notNull(),
  maxUsesTotal: integer('max_uses_total'),
  maxUsesPerCustomer: integer('max_uses_per_customer').notNull().default(1),
  minSubtotalRial: integer('min_subtotal_rial').notNull().default(0),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  // When set, only this phone number may redeem the coupon (checked
  // alongside the normal active/expiry/usage checks in evaluateCoupon).
  // Null means unrestricted.
  assignedPhone: text('assigned_phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Mirrors inventory_reservations' state machine so a coupon hold and a stock
// hold rise and fall together for the same order.
export const couponUsages = pgTable(
  'coupon_usages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    orderId: bigserial('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerPhone: text('customer_phone').notNull(),
    status: reservationStatusEnum('status').notNull().default('reserved'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    unique('coupon_usages_order_uidx').on(table.orderId),
    index('coupon_usages_coupon_status_idx').on(table.couponId, table.status),
    index('coupon_usages_expires_at_idx').on(table.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: adminRoleEnum('role').notNull().default('owner'),
  // OWNER-revoked admins are deactivated, never deleted — preserves the
  // audit trail (who did what) while immediately blocking login and
  // invalidating every existing session (see lib/admin/session.ts).
  active: boolean('active').notNull().default(true),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('admin_sessions_admin_id_idx').on(table.adminId)],
);

// One row per manual stock change made in /admin/inventory — additive audit
// log, never updated or deleted, so "what happened to this variant's stock
// and who did it" stays answerable regardless of what the row's resulting
// value later becomes.
export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    delta: integer('delta').notNull(),
    resultingStock: integer('resulting_stock').notNull(),
    reason: text('reason').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('inventory_adjustments_variant_id_idx').on(table.variantId)],
);

// Generic sliding-window counter, called directly from domain functions
// (login, checkout/startPayment, validateCoupon) as defense-in-depth
// alongside (not instead of) middleware.ts's coarser IP-based limiting.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

// Tracks every admin upload regardless of storage backend, so swapping
// lib/media/storage.ts's implementation from local-disk to object storage
// later touches only that file — never this table or its callers.
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  storageKey: text('storage_key').notNull().unique(),
  url: text('url').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Site content
// ---------------------------------------------------------------------------

export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  announcement: text('announcement').notNull().default(''),
  heroTitle: text('hero_title').notNull().default(''),
  heroSubtitle: text('hero_subtitle').notNull().default(''),
  heroImageUrl: text('hero_image_url'),
  footerText: text('footer_text').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supportPages = pgTable('support_pages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  bodyHtml: text('body_html').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const faqs = pgTable(
  'faqs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('faqs_sort_order_idx').on(table.sortOrder)],
);
