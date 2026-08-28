// Local JSON catalog — replaces the WooCommerce Store API as the product source.
// Data lives in DATA_DIR (default ./data): products.json (seeded, admin-editable),
// settings.json (hero/announcement texts), orders.json (created at first order).
// Files are the source of truth so the admin panel edits survive restarts; in
// Docker DATA_DIR is a bind mount. Writes are tmp+rename to avoid torn files.
import { normalizePersian } from './format.ts';
import { DEFAULT_SUPPORT_CONTENT, type SupportContent } from './faq.ts';
import { readJson as readStore, writeJson as writeStore, mutate } from './store.ts';

export type Product = {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  priceRial: number;
  salePriceRial: number | null;
  images: string[];
  category: string;
  sizes: string[];
  colors: string[];
  inStock: boolean;
  featured: boolean;
};

export type Category = { slug: string; name: string; description: string };
export type Catalog = { categories: Category[]; products: Product[] };

export type Settings = {
  announcement: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  footerText: string;
};

export type OrderStatus = 'new' | 'processing' | 'shipped' | 'done' | 'canceled';
export type OrderItem = {
  productId: number;
  name: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  priceRial: number;
};
/**
 * Where an order stands with the payment gateway. Distinct from OrderStatus,
 * which is about fulfilment: an order can be 'paid' but still 'new' to ship.
 * 'awaiting' = order created, the user has not returned from the bank yet.
 */
export type PaymentState = 'unpaid' | 'awaiting' | 'paid' | 'failed';

export type Order = {
  id: number;
  createdAt: string;
  status: OrderStatus;
  customer: { name: string; phone: string; email: string; state: string; city: string; address: string; postcode: string };
  items: OrderItem[];
  totalRial: number;
  /** Absent on orders placed before the gateway existed - read via orderPaymentState(). */
  paymentState?: PaymentState;
  /** trackId of the payment attempt that succeeded, for cross-referencing payments.json. */
  paidTrackId?: string | null;
  paidAt?: string | null;
};

/** Orders written before the payment gateway existed have no paymentState. */
export const orderPaymentState = (o: Order): PaymentState => o.paymentState ?? 'unpaid';

const readJson = <T,>(file: string, fallback: T): Promise<T> => readStore(file, fallback, 'catalog');
const writeJson = (file: string, data: unknown): Promise<void> => writeStore(file, data);

const EMPTY_CATALOG: Catalog = { categories: [], products: [] };

export const getCatalog = (): Promise<Catalog> => readJson('products.json', EMPTY_CATALOG);
export const saveCatalog = (c: Catalog): Promise<void> => writeJson('products.json', c);

const DEFAULT_SETTINGS: Settings = {
  announcement: '',
  heroTitle: 'روایتی از اسطوره و میراث ایران، بر تن شما',
  heroSubtitle: '',
  heroImage: '',
  footerText: '',
};

export const getSettings = (): Promise<Settings> =>
  readJson('settings.json', DEFAULT_SETTINGS).then((s) => ({ ...DEFAULT_SETTINGS, ...s }));
export const saveSettings = (s: Settings): Promise<void> => writeJson('settings.json', s);

export const getSupportContent = (): Promise<SupportContent> =>
  readJson('support.json', DEFAULT_SUPPORT_CONTENT).then((s) => ({ ...DEFAULT_SUPPORT_CONTENT, ...s }));
export const saveSupportContent = (s: SupportContent): Promise<void> => writeJson('support.json', s);

/** Effective sale price helpers. A sale is only real when below the regular price. */
export const effectivePrice = (p: Product): number =>
  p.salePriceRial && p.salePriceRial < p.priceRial ? p.salePriceRial : p.priceRial;
export const isOnSale = (p: Product): boolean =>
  Boolean(p.salePriceRial && p.salePriceRial < p.priceRial);

export type ProductQuery = {
  category?: string;
  featured?: boolean;
  onSale?: boolean;
  search?: string;
  sort?: 'new' | 'price-asc' | 'price-desc';
};

export async function getProducts(q: ProductQuery = {}): Promise<Product[]> {
  const { products } = await getCatalog();
  let list = products;
  if (q.category) list = list.filter((p) => p.category === q.category);
  if (q.featured) list = list.filter((p) => p.featured);
  if (q.onSale) list = list.filter(isOnSale);
  if (q.search) {
    const needle = normalizePersian(q.search);
    list = list.filter((p) =>
      normalizePersian(`${p.name} ${p.subtitle} ${p.description}`).includes(needle),
    );
  }
  if (q.sort === 'new') list = [...list].sort((a, b) => b.id - a.id);
  if (q.sort === 'price-asc') list = [...list].sort((a, b) => effectivePrice(a) - effectivePrice(b));
  if (q.sort === 'price-desc') list = [...list].sort((a, b) => effectivePrice(b) - effectivePrice(a));
  return list;
}

/**
 * Next's dynamic route params are supposed to arrive already URL-decoded, but
 * for percent-encoded UTF-8 segments (non-Latin slugs) this has been observed
 * to sometimes reach the page still encoded (e.g. literal "%D8%AA%D8%B3%D8%AA"
 * instead of "تست") depending on the request. Decoding here — a no-op for a
 * slug that has no '%' — makes the lookup work either way instead of silently
 * 404ing on non-Latin slugs.
 */
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products } = await getCatalog();
  const target = decodeSlug(slug);
  return products.find((p) => p.slug === target) ?? null;
}

export async function getCategories(): Promise<(Category & { count: number; image?: string })[]> {
  const { categories, products } = await getCatalog();
  return categories.map((c) => {
    const inCat = products.filter((p) => p.category === c.slug);
    return { ...c, count: inCat.length, image: inCat[0]?.images[0] };
  });
}

export async function uniqueSlug(base: string, ignoreId?: number): Promise<string> {
  const { products } = await getCatalog();
  const taken = new Set(products.filter((p) => p.id !== ignoreId).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createProduct(p: Omit<Product, 'id'>): Promise<Product> {
  const catalog = await getCatalog();
  const id = Math.max(0, ...catalog.products.map((x) => x.id)) + 1;
  const product: Product = { ...p, id };
  await saveCatalog({ ...catalog, products: [...catalog.products, product] });
  return product;
}

export async function deleteProduct(id: number): Promise<Product | null> {
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.id === id);
  if (!product) return null;
  await saveCatalog({ ...catalog, products: catalog.products.filter((p) => p.id !== id) });
  return product;
}

export async function getRelated(product: Product, limit = 4): Promise<Product[]> {
  const { products } = await getCatalog();
  const same = products.filter((p) => p.category === product.category && p.id !== product.id);
  const rest = products.filter((p) => p.category !== product.category && p.id !== product.id);
  return [...same, ...rest].slice(0, limit);
}

// --- Orders ---------------------------------------------------------------
//
// Order ids double as the Zibal orderId, so they must never be reused. Every
// mutation goes through mutate() to serialise read-modify-write: a payment
// callback marking an order paid can otherwise race an admin status change and
// one of the two writes is lost.

const ORDERS = 'orders.json';

export const listOrders = (): Promise<Order[]> => readJson<Order[]>(ORDERS, []);

export async function getOrder(id: number): Promise<Order | null> {
  const orders = await listOrders();
  return orders.find((o) => o.id === id) ?? null;
}

/**
 * Order ids are handed out from a counter that only ever goes up, kept in its
 * own file so that deleting orders cannot lower it. Deriving the next id from
 * max(existing ids) would reissue the id of a deleted trailing order, and a
 * stale Zibal callback naming that orderId would then land on a different
 * customer's order. The counter is seeded from the highest id ever seen.
 */
const COUNTERS = 'counters.json';

function nextOrderId(orders: Order[]): Promise<number> {
  const floor = Math.max(1000, ...orders.map((o) => o.id));
  return mutate<{ orderId?: number }, number>(
    COUNTERS,
    {},
    (c) => {
      const id = Math.max(c.orderId ?? 0, floor) + 1;
      return [{ ...c, orderId: id }, id];
    },
    'catalog',
  );
}

export async function createOrder(
  customer: Order['customer'],
  items: OrderItem[],
): Promise<Order> {
  const id = await nextOrderId(await listOrders());
  return mutate<Order[], Order>(
    ORDERS,
    [],
    (orders) => {
      const order: Order = {
        id,
        createdAt: new Date().toISOString(),
        status: 'new',
        customer,
        items,
        totalRial: items.reduce((sum, i) => sum + i.priceRial * i.quantity, 0),
        paymentState: 'unpaid',
        paidTrackId: null,
        paidAt: null,
      };
      return [[...orders, order], order];
    },
    'catalog',
  );
}

const patchOrder = (id: number, patch: Partial<Order>): Promise<Order | null> =>
  mutate<Order[], Order | null>(
    ORDERS,
    [],
    (orders) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return [orders, null];
      const next = orders.slice();
      next[idx] = { ...next[idx], ...patch };
      return [next, next[idx]];
    },
    'catalog',
  );

export const updateOrderStatus = (id: number, status: OrderStatus): Promise<Order | null> =>
  patchOrder(id, { status });

export const setOrderPaymentState = (
  id: number,
  paymentState: PaymentState,
  extra: { paidTrackId?: string | null; paidAt?: string | null } = {},
): Promise<Order | null> => patchOrder(id, { paymentState, ...extra });

export function deleteOrder(id: number): Promise<void> {
  return mutate<Order[], void>(
    ORDERS,
    [],
    (orders) => [orders.filter((o) => o.id !== id), undefined],
    'catalog',
  );
}

/** Never let a data hiccup blank the storefront — log and render what we can. */
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error('[catalog]', err instanceof Error ? err.message : err);
    return fallback;
  }
}
