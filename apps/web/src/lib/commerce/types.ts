import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '@/db/schema';

// Structural type shared by `db` and any `tx` handed to a callback inside
// `db.transaction(...)` — lets inventory.ts/coupons.ts/orders.ts helpers run
// either standalone or as part of a caller's transaction.
export type DbClient = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Money = { amount: number; currency: 'IRR' };

export type Image = { url: string; altText: string };

export type SelectedOption = { name: string; value: string };
export type ProductOption = { id: string; name: string; values: string[] };

export type ProductVariant = {
  id: string;
  sku: string | null;
  title: string;
  availableForSale: boolean;
  stock: number;
  selectedOptions: SelectedOption[];
  price: Money;
  compareAtPrice: Money | null;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  images: Image[];
  options: ProductOption[];
  variants: ProductVariant[];
  price: Money;
  salePrice: Money | null;
  categorySlug: string | null;
  featured: boolean;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  productCount: number;
  image: Image | null;
};

export type SortKey = 'relevance' | 'newest' | 'price-asc' | 'price-desc';

export type CartItem = {
  id: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: ProductVariant;
};

export type Cart = {
  id: string;
  token: string;
  items: CartItem[];
  itemCount: number;
  subtotal: Money;
};

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'completed' | 'canceled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed';

export type OrderItem = {
  id: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  unitPrice: Money;
  quantity: number;
};

export type ShippingInput = {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
};

export type Order = {
  id: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  cartToken: string;
  shipping: ShippingInput;
  items: OrderItem[];
  subtotal: Money;
  discount: Money;
  shippingCost: Money;
  total: Money;
  createdAt: Date;
};

export type Coupon = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
};

export type CouponRejectionReason =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'min_subtotal'
  | 'usage_limit_reached';

export type CouponValidationResult =
  | { ok: true; couponId: string; discountRial: number }
  | { ok: false; reason: CouponRejectionReason };

export function toRial(amount: number): Money {
  return { amount, currency: 'IRR' };
}
