'use client';

import React, { useState } from 'react';
import { Archive, Image as ImageIcon, Music, Shirt } from 'lucide-react';
import { PRODUCT_CATEGORIES, PRODUCTS, type ProductCategory } from '@/lib/products';
import { createProductCheckout } from '@/app/actions/purchase';

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  Apparel: Shirt,
  'Art Prints': ImageIcon,
  'Audio/Digital': Music,
  'Vault Items': Archive,
};

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ProductsStorefront() {
  const [activeCategory, setActiveCategory] = useState<'ALL' | ProductCategory>('ALL');

  const visibleProducts = PRODUCTS.filter(
    (p) => activeCategory === 'ALL' || p.category === activeCategory
  );

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-6xl px-6 py-10 mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-white">Products</h2>
          <p className="max-w-lg mx-auto text-sm text-slate-400">
            A first look at the storefront — demo items shown below until the real catalog goes live.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition border ${
              activeCategory === 'ALL'
                ? 'bg-white/20 text-white border-neutral-700'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            All
          </button>
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition border ${
                activeCategory === cat
                  ? 'bg-white/20 text-white border-neutral-700'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => {
            const Icon = CATEGORY_ICONS[product.category];
            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden transition border rounded-xl bg-[#0B0E14]/80 backdrop-blur-sm border-slate-800 hover:border-slate-700 hover:shadow-[0_0_16px_rgba(255,255,255,0.06)]"
              >
                {/* Placeholder image frame — no real product photography yet */}
                <div className="relative flex items-center justify-center border-b aspect-square bg-slate-900/60 border-slate-800">
                  <Icon className="w-10 h-10 text-slate-600" />
                  <span className="absolute px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded top-2 right-2 bg-black/60 text-slate-400 border-slate-700">
                    Demo
                  </span>
                </div>

                <div className="flex flex-col flex-1 p-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      {product.category}
                    </span>
                    <h3 className="text-sm font-bold text-white">{product.name}</h3>
                    <p className="text-xs text-slate-400">{product.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-800/80">
                    <span className="text-lg font-bold text-white">${formatPrice(product.amount)}</span>
                    <form action={createProductCheckout}>
                      <input type="hidden" name="productId" value={product.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
                      >
                        Buy Now
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
