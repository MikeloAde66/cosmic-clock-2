'use client';

import React, { useEffect, useState } from 'react';
import { Archive, Image as ImageIcon, Music, Shirt } from 'lucide-react';
import { PRODUCT_CATEGORIES, PRODUCTS, type ProductCategory } from '@/lib/products';
import type { PublishedVaultProduct } from '@/lib/vaultRegistry';
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

// Unifies the static demo catalog (lib/products.ts) with admin-published
// Vault packs (GET /api/vault/published) into one shape the grid can render
// without caring which system a given card came from.
interface DisplayProduct {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  amount: number;
  isDemo: boolean;
  // Set only for Vault-variant listings (e.g. "PHYSICAL ORIGINAL",
  // "DIGITAL DOWNLOAD") — a single Vault master item can generate several
  // of these side by side, each its own card/listing here rather than a
  // dropdown on one product page (this storefront has no per-product
  // detail page to put a selector on).
  variantBadge?: string;
}

export default function ProductsStorefront() {
  const [activeCategory, setActiveCategory] = useState<'ALL' | ProductCategory>('ALL');
  const [vaultProducts, setVaultProducts] = useState<PublishedVaultProduct[]>([]);

  useEffect(() => {
    fetch('/api/vault/published')
      .then((res) => res.json())
      .then((data: { products: PublishedVaultProduct[] }) => setVaultProducts(data.products || []))
      .catch((err) => console.error('Failed to load published Vault items:', err));
  }, []);

  const allProducts: DisplayProduct[] = [
    ...PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      amount: p.amount,
      isDemo: true,
    })),
    // Vault-origin items (templates, automations, planners, etc.) an admin
    // has explicitly priced and published — always real, never demo. Use
    // the id GET /api/vault/published already built rather than
    // reconstructing it here — a pack with multiple variants returns one
    // row per variant, each needing its own distinct id.
    ...vaultProducts.map((v) => ({
      id: v.id,
      name: v.title,
      category: 'Vault Items' as ProductCategory,
      description: v.description,
      amount: v.priceCents,
      isDemo: false,
      variantBadge: v.productType?.replace(/_/g, ' '),
    })),
  ];

  const visibleProducts = allProducts.filter(
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
                  {product.isDemo && (
                    <span className="absolute px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded top-2 right-2 bg-black/60 text-slate-400 border-slate-700">
                      Demo
                    </span>
                  )}
                </div>

                <div className="flex flex-col flex-1 p-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      {product.category}
                    </span>
                    <h3 className="text-sm font-bold text-white">{product.name}</h3>
                    <p className="text-xs text-slate-400">{product.description}</p>
                    {product.variantBadge && (
                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded bg-slate-900/80 text-slate-400 border-slate-700">
                        {product.variantBadge}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 mt-auto space-y-2 border-t border-slate-800/80">
                    <span className="text-lg font-bold text-white">${formatPrice(product.amount)}</span>
                    <form action={createProductCheckout} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        type="text"
                        name="promoCode"
                        placeholder="Promo code"
                        className="w-0 flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono border rounded-lg bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/50"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition shrink-0"
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
