'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  amount: number; // cents, unit price
  imageUrl?: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number; // cents
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'cosmic_cart_v1';
const MAX_QUANTITY = 99;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Runs once after mount, never during render — reading localStorage at
  // render time would produce a server/client markup mismatch (there's no
  // localStorage during SSR). A completed purchase takes priority over
  // restoring a stale cart: land back here with ?purchase=success and the
  // cart that was just paid for is cleared instead of reappearing. The
  // setState calls are deferred a microtask out so they run as a reaction to
  // reading the external store, not synchronously inline in the effect body.
  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('purchase') === 'success') {
        localStorage.removeItem(STORAGE_KEY);
        setHydrated(true);
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch {
        // Corrupt or inaccessible storage — start with an empty cart rather than crashing.
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_QUANTITY) } : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(quantity, MAX_QUANTITY) }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity < 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, MAX_QUANTITY) } : i));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.amount * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQuantity, clear, itemCount, subtotal }),
    [items, addItem, removeItem, setQuantity, clear, itemCount, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider.');
  return ctx;
}
