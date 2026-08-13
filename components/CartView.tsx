'use client';

import React, { useActionState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { createCartCheckout, type CartCheckoutState } from '@/app/actions/purchase';

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

const initialState: CartCheckoutState = { error: null };

export default function CartView() {
  const { items, removeItem, setQuantity, subtotal } = useCart();
  const [state, formAction, isPending] = useActionState(createCartCheckout, initialState);

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-3xl px-6 py-10 mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-white">Cart</h2>
          <p className="max-w-lg mx-auto text-sm text-slate-400">
            {items.length === 0 ? 'Your cart is empty.' : 'Review your items before checkout.'}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-600">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">Add something from Products to get started.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-4 p-3 border rounded-xl bg-[#0B0E14]/80 border-slate-800"
                >
                  <div className="flex items-center justify-center w-16 h-16 overflow-hidden border rounded-lg shrink-0 bg-slate-900/60 border-slate-800">
                    {item.imageUrl && !item.imageUrl.endsWith('.mp4') ? (
                      // eslint-disable-next-line @next/next/no-img-element -- mix of local /public assets and external Printful CDN URLs
                      <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                    ) : (
                      <ShoppingCart className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{item.name}</h3>
                    <p className="text-xs text-slate-400">${formatPrice(item.amount)} each</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      className="flex items-center justify-center border rounded w-7 h-7 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-sm text-center text-white font-mono">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      className="flex items-center justify-center border rounded w-7 h-7 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="w-16 text-sm font-bold text-right text-white shrink-0">
                    ${formatPrice(item.amount * item.quantity)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="flex items-center justify-center border rounded w-7 h-7 border-slate-800 text-slate-500 hover:border-red-800 hover:text-red-400 transition shrink-0"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form action={formAction} className="p-4 space-y-4 border rounded-xl bg-[#0B0E14]/80 border-slate-800">
              <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, quantity: i.quantity })))} />

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Subtotal</span>
                <span className="text-xl font-bold text-white">${formatPrice(subtotal)}</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="promoCode"
                  placeholder="Promo code"
                  className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border rounded-lg bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/50"
                />
              </div>

              {state.error && <p className="text-xs text-red-400">{state.error}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full px-4 py-2.5 text-sm font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Redirecting to checkout…' : 'Checkout'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
