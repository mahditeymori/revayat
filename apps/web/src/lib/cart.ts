// Local cookie cart. The cookie stores only refs ({id, size, color, qty}) —
// prices and names are always resolved server-side from the catalog, so a
// tampered cookie can never change a price. httpOnly: the browser JS never
// needs to read it; all mutations go through server actions.
import { cookies, headers } from 'next/headers';
import { getCatalog, effectivePrice, type Product } from './catalog';

const CART_COOKIE = 'revayat_cart';
// Non-httpOnly mirror of the total qty so the header badge can read it from
// client JS without forcing ISR pages dynamic. Display-only — never trusted.
const COUNT_COOKIE = 'revayat_cart_count';

// NODE_ENV is always "production" in the Docker image regardless of whether
// TLS is actually terminated in front of it (see nginx.conf — plain HTTP).
// A cookie marked Secure on a non-HTTPS response is silently dropped by the
// browser, so `secure` must reflect the real request scheme, not the build mode.
async function cookieOpts(): Promise<Parameters<Awaited<ReturnType<typeof cookies>>['set']>[2]> {
  const proto = (await headers()).get('x-forwarded-proto');
  return {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  };
}

type Ref = { id: number; size: string; color: string; qty: number };

export type CartItem = {
  key: string;
  product: Product;
  size: string;
  color: string;
  quantity: number;
  priceRial: number;
  lineTotalRial: number;
};

export type Cart = { itemCount: number; items: CartItem[]; totalRial: number };

const keyOf = (r: { id: number; size: string; color: string }) => `${r.id}|${r.size}|${r.color}`;

async function readRefs(): Promise<Ref[]> {
  try {
    const raw = (await cookies()).get(CART_COOKIE)?.value;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Ref[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => Number.isInteger(r.id) && r.id > 0)
      .map((r) => ({ ...r, qty: Math.min(99, Math.max(1, Math.trunc(Number(r.qty) || 1))) }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

async function writeRefs(refs: Ref[]): Promise<void> {
  const store = await cookies();
  if (refs.length === 0) {
    store.delete(CART_COOKIE);
    store.delete(COUNT_COOKIE);
  } else {
    const opts = await cookieOpts();
    store.set(CART_COOKIE, JSON.stringify(refs), opts);
    const count = refs.reduce((n, r) => n + r.qty, 0);
    store.set(COUNT_COOKIE, String(count), { ...opts, httpOnly: false });
  }
}

export async function getCart(): Promise<Cart> {
  const [refs, { products }] = await Promise.all([readRefs(), getCatalog()]);
  const items: CartItem[] = [];
  for (const r of refs) {
    const product = products.find((p) => p.id === r.id);
    if (!product) continue; // product deleted in admin — drop silently
    const price = effectivePrice(product);
    items.push({
      key: keyOf(r),
      product,
      size: r.size,
      color: r.color,
      quantity: r.qty,
      priceRial: price,
      lineTotalRial: price * r.qty,
    });
  }
  return {
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    items,
    totalRial: items.reduce((sum, i) => sum + i.lineTotalRial, 0),
  };
}

export async function addToCart(id: number, size: string, color: string, qty: number): Promise<void> {
  const refs = await readRefs();
  const key = keyOf({ id, size, color });
  const existing = refs.find((r) => keyOf(r) === key);
  if (existing) existing.qty = Math.min(99, existing.qty + qty);
  else refs.push({ id, size, color, qty });
  await writeRefs(refs);
}

export async function updateCartItem(key: string, qty: number): Promise<void> {
  const refs = await readRefs();
  const next = qty <= 0 ? refs.filter((r) => keyOf(r) !== key) : refs.map((r) => (keyOf(r) === key ? { ...r, qty } : r));
  await writeRefs(next);
}

export async function clearCart(): Promise<void> {
  await writeRefs([]);
}
