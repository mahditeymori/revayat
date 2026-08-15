// Parses the non-httpOnly revayat_cart_count cookie (written in lib/cart.ts)
// for the header badge. Display-only value — never trusted for pricing.
export function readCartCount(cookie: string): number {
  const m = cookie.match(/(?:^|;\s*)revayat_cart_count=(\d+)/);
  return m ? Math.min(999, Number(m[1])) : 0;
}
