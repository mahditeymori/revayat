'use client';

// Single client-side source of truth for the cart drawer. CartBadge is left
// completely untouched — it already reads the count cookie independently and
// works correctly; this provider just also dispatches the same 'cart:updated'
// window event on every mutation, so the two stay in sync via the existing
// contract without any direct coupling.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Cart } from '@/lib/cart';
import { getCartAction, setCartQtyAction, removeCartItemFromDrawerAction } from '@/app/cart/drawer-actions';

type CartContextValue = {
  cart: Cart | null;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Guards against out-of-order responses (rapid stepper clicks, or a mutation
  // resolving after a fresh load was kicked off) — only the latest request's
  // result is ever committed to state.
  const stamp = useRef(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  // A mutation already dispatches 'cart:updated' with a known-fresh result;
  // suppress the provider's own listener from firing a redundant extra fetch.
  const suppressNext = useRef(false);

  const load = useCallback(() => {
    const id = ++stamp.current;
    getCartAction().then((next) => {
      if (id === stamp.current) setCart(next);
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setCart((current) => {
      if (current === null) load();
      return current;
    });
  }, [load]);

  const close = useCallback(() => setIsOpen(false), []);

  const applyMutation = useCallback((run: () => Promise<Cart>) => {
    const id = ++stamp.current;
    run().then((next) => {
      if (id === stamp.current) setCart(next);
      suppressNext.current = true;
      window.dispatchEvent(new Event('cart:updated'));
    });
  }, []);

  const setQty = useCallback(
    (key: string, qty: number) => applyMutation(() => setCartQtyAction(key, qty)),
    [applyMutation],
  );
  const remove = useCallback(
    (key: string) => applyMutation(() => removeCartItemFromDrawerAction(key)),
    [applyMutation],
  );

  // Reflect edits made elsewhere (the full /cart page's own form actions
  // already dispatch this same event) while the drawer is open.
  useEffect(() => {
    function handle() {
      if (suppressNext.current) {
        suppressNext.current = false;
        return;
      }
      if (isOpenRef.current) load();
    }
    window.addEventListener('cart:updated', handle);
    return () => window.removeEventListener('cart:updated', handle);
  }, [load]);

  // Never leave the drawer open across a navigation it didn't itself trigger
  // (e.g. checkout redirecting to /cart when the cart turned out empty).
  const firstPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPathname.current) {
      firstPathname.current = pathname;
      setIsOpen(false);
    }
  }, [pathname]);

  return (
    <CartContext.Provider value={{ cart, isOpen, open, close, setQty, remove }}>
      {children}
    </CartContext.Provider>
  );
}
