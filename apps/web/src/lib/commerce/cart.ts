import 'server-only';
import crypto from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { cartItems, carts, categories, productVariants, products } from '@/db/schema';
import { getAvailableStock } from './inventory';
import { hydrateProducts } from './products';
import type { Cart, CartItem } from './types';

async function findCartRow(token: string) {
  return db.query.carts.findFirst({ where: eq(carts.token, token) });
}

async function insertCartRow(token: string) {
  const [row] = await db.insert(carts).values({ token }).returning();
  return row;
}

async function hydrateCart(cartRow: { id: string; token: string }): Promise<Cart> {
  const itemRows = await db
    .select({
      id: cartItems.id,
      variantId: cartItems.variantId,
      productId: productVariants.productId,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .where(eq(cartItems.cartId, cartRow.id))
    .orderBy(asc(cartItems.createdAt));

  if (itemRows.length === 0) {
    return { id: cartRow.id, token: cartRow.token, items: [], itemCount: 0, subtotal: { amount: 0, currency: 'IRR' } };
  }

  const productIds = [...new Set(itemRows.map((r) => r.productId))];
  const baseRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      subtitle: products.subtitle,
      description: products.description,
      priceRial: products.priceRial,
      salePriceRial: products.salePriceRial,
      categorySlug: categories.slug,
      featured: products.featured,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(products.id, productIds));

  const hydratedProducts = await hydrateProducts(baseRows);
  const productById = new Map(hydratedProducts.map((p) => [p.id, p]));

  const items: CartItem[] = [];
  let subtotalAmount = 0;
  for (const row of itemRows) {
    const product = productById.get(row.productId);
    const variant = product?.variants.find((v) => v.id === row.variantId);
    if (!product || !variant) continue;
    items.push({ id: row.id, variantId: row.variantId, quantity: row.quantity, product, variant });
    subtotalAmount += variant.price.amount * row.quantity;
  }

  return {
    id: cartRow.id,
    token: cartRow.token,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: { amount: subtotalAmount, currency: 'IRR' },
  };
}

export async function getCart(cartToken: string | undefined): Promise<Cart | null> {
  if (!cartToken) return null;
  const cartRow = await findCartRow(cartToken);
  if (!cartRow) return null;
  return hydrateCart(cartRow);
}

export async function createCart(): Promise<Cart> {
  const token = crypto.randomUUID();
  const cartRow = await insertCartRow(token);
  return { id: cartRow.id, token: cartRow.token, items: [], itemCount: 0, subtotal: { amount: 0, currency: 'IRR' } };
}

// Lazily materializes the cart row for a caller-issued token if none exists
// yet — the cookie value is chosen before the first item is ever added.
async function getOrCreateCartRow(cartToken: string | undefined) {
  if (cartToken) {
    const existing = await findCartRow(cartToken);
    if (existing) return existing;
  }
  return insertCartRow(cartToken ?? crypto.randomUUID());
}

export async function addToCart(
  cartToken: string | undefined,
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const cartRow = await getOrCreateCartRow(cartToken);

  const [existingItem] = await db
    .select({ id: cartItems.id, quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.variantId, variantId)));

  const availableStock = await getAvailableStock(variantId);
  const desiredQuantity = (existingItem?.quantity ?? 0) + quantity;
  const clampedQuantity = Math.max(Math.min(desiredQuantity, availableStock), 0);

  if (clampedQuantity === 0) {
    if (existingItem) {
      await db.delete(cartItems).where(eq(cartItems.id, existingItem.id));
    }
  } else if (existingItem) {
    await db.update(cartItems).set({ quantity: clampedQuantity }).where(eq(cartItems.id, existingItem.id));
  } else {
    await db.insert(cartItems).values({ cartId: cartRow.id, variantId, quantity: clampedQuantity });
  }

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartRow.id));
  return hydrateCart(cartRow);
}

export async function updateCartItem(cartToken: string, itemId: string, quantity: number): Promise<Cart> {
  const cartRow = await findCartRow(cartToken);
  if (!cartRow) throw new Error('Cart not found');

  const [item] = await db
    .select({ id: cartItems.id, variantId: cartItems.variantId })
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartRow.id)));
  if (!item) throw new Error('Cart item not found');

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, item.id));
  } else {
    const availableStock = await getAvailableStock(item.variantId);
    await db
      .update(cartItems)
      .set({ quantity: Math.min(quantity, availableStock) })
      .where(eq(cartItems.id, item.id));
  }

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartRow.id));
  return hydrateCart(cartRow);
}

export async function removeFromCart(cartToken: string, itemId: string): Promise<Cart> {
  const cartRow = await findCartRow(cartToken);
  if (!cartRow) throw new Error('Cart not found');

  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartRow.id)));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartRow.id));
  return hydrateCart(cartRow);
}
