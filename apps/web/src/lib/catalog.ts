// Local JSON catalog — replaces the WooCommerce Store API as the product source.
// Data lives in DATA_DIR (default ./data): products.json (seeded, admin-editable),
// settings.json (hero/announcement texts), orders.json (created at first order).
// Files are the source of truth so the admin panel edits survive restarts; in
// Docker DATA_DIR is a bind mount. Writes are tmp+rename to avoid torn files.
import { promises as fs } from 'fs';
import path from 'path';
import { normalizePersian } from './format.ts';
import { DEFAULT_SUPPORT_CONTENT, type SupportContent } from './faq.ts';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');

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
export type Order = {
  id: number;
  createdAt: string;
  status: OrderStatus;
  customer: { name: string; phone: string; email: string; state: string; city: string; address: string; postcode: string };
  items: OrderItem[];
  totalRial: number;
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
  } catch {
    return fallback; // not created yet (e.g. orders.json before the first order)
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    // A malformed file is a real problem — falling back silently makes the site
    // look fine while serving default content. Loud, but still non-fatal.
    console.error(`[catalog] ${file} is not valid JSON:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

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

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug) ?? null;
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

export const listOrders = (): Promise<Order[]> => readJson<Order[]>('orders.json', []);

export async function createOrder(
  customer: Order['customer'],
  items: OrderItem[],
): Promise<Order> {
  const orders = await listOrders();
  const order: Order = {
    id: (orders.at(-1)?.id ?? 1000) + 1,
    createdAt: new Date().toISOString(),
    status: 'new',
    customer,
    items,
    totalRial: items.reduce((sum, i) => sum + i.priceRial * i.quantity, 0),
  };
  await writeJson('orders.json', [...orders, order]);
  return order;
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
  const orders = await listOrders();
  await writeJson(
    'orders.json',
    orders.map((o) => (o.id === id ? { ...o, status } : o)),
  );
}

export async function deleteOrder(id: number): Promise<void> {
  const orders = await listOrders();
  await writeJson(
    'orders.json',
    orders.filter((o) => o.id !== id),
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
