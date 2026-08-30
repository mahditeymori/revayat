'use client';

// Single client-side source of truth for cart state, shared verbatim by the
// header badge, the drawer, and the /cart page — all three render from this
// same context instead of fetching independently, so there is nothing to
// keep "in sync": there is only one cart in memory. Every mutation calls the
// unified Server Actions in app/cart/actions.ts (never a second, drawer-only
// implementation) and reconciles the optimistic guess against whatever the
// server actually persisted, including any quantity clamp to live stock.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { usePathname } from 'next/navigation';
import { getCartAction, updateCartItemAction, removeFromCartAction } from '@/app/cart/actions';
import { emptyCart, deriveCartTotals } from '@/lib/commerce/cartTotals';
import type { Cart } from '@/lib/commerce/types';

type CartContextValue = {
  cart: Cart;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  afterAdd: () => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart());
  const [optimisticCart, applyOptimistic] = useOptimistic(
    cart,
    (state: Cart, updater: (current: Cart) => Cart) => updater(state),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  // Guards against out-of-order responses (rapid stepper clicks resolving
  // out of order) — only the latest request's result is ever committed.
  const stamp = useRef(0);

  const refresh = useCallback(() => {
    const id = ++stamp.current;
    getCartAction()
      .then((next) => {
        if (id !== stamp.current) return;
        setCart(next);
        setError(null);
      })
      .catch((err) => {
        if (id !== stamp.current) return;
        setError(err instanceof Error ? err.message : 'خطا در بارگذاری سبد خرید');
      })
      .finally(() => {
        if (id === stamp.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Called by the product page's own add-to-cart form (VariantSelector,
  // useActionState) once its submit resolves successfully: re-pulls the
  // authoritative cart and opens the drawer, exactly the Next.js Commerce
  // "add opens the drawer" pattern.
  const afterAdd = useCallback(() => {
    refresh();
    setIsOpen(true);
  }, [refresh]);

  const setQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const id = ++stamp.current;
      startTransition(async () => {
        applyOptimistic((current) =>
          deriveCartTotals({
            ...current,
            items:
              quantity <= 0
                ? current.items.filter((item) => item.id !== itemId)
                : current.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
          }),
        );
        try {
          const next = await updateCartItemAction(itemId, quantity);
          if (id !== stamp.current) return;
          setCart(next);
          setError(null);
        } catch (err) {
          if (id !== stamp.current) return;
          setError(err instanceof Error ? err.message : 'خطا در به‌روزرسانی سبد خرید');
          refresh();
        }
      });
    },
    [applyOptimistic, refresh, startTransition],
  );

  const remove = useCallback(
    (itemId: string) => {
      const id = ++stamp.current;
      startTransition(async () => {
        applyOptimistic((current) =>
          deriveCartTotals({ ...current, items: current.items.filter((item) => item.id !== itemId) }),
        );
        try {
          const next = await removeFromCartAction(itemId);
          if (id !== stamp.current) return;
          setCart(next);
          setError(null);
        } catch (err) {
          if (id !== stamp.current) return;
          setError(err instanceof Error ? err.message : 'خطا در حذف از سبد خرید');
          refresh();
        }
      });
    },
    [applyOptimistic, refresh, startTransition],
  );

  // Never leave the drawer open across a navigation it didn't itself
  // trigger (e.g. checkout redirecting away once the cart is confirmed).
  const firstPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPathname.current) {
      firstPathname.current = pathname;
      setIsOpen(false);
    }
  }, [pathname]);

  return (
    <CartContext.Provider
      value={{ cart: optimisticCart, loading, error, isOpen, open, close, afterAdd, setQuantity, remove }}
    >
      {children}
    </CartContext.Provider>
  );
}
