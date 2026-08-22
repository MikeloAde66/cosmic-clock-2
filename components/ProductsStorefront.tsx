'use client';

import React, { useEffect, useState } from 'react';
import { Archive, Backpack, Check, PenSquare, Shirt } from 'lucide-react';
import { PRODUCT_CATEGORIES, PRODUCTS, type ProductCategory } from '@/lib/products';
import type { PublishedVaultProduct } from '@/lib/vaultRegistry';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { getOverride } from '@/lib/productOverrides';
import ProductDetailView from './ProductDetailView';

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  Apparel: Shirt,
  'Survival Gear': Backpack,
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
  // Real mockup/photography, when it exists — only the first is shown per
  // card (a flat grid, no per-product detail page for a full gallery).
  imageUrl?: string;
}

export default function ProductsStorefront() {
  const [activeCategory, setActiveCategory] = useState<'ALL' | ProductCategory>('ALL');
  const [vaultProducts, setVaultProducts] = useState<PublishedVaultProduct[]>([]);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<DisplayProduct | null>(null);
  // Real RBAC — same Supabase app_metadata.role convention as Cosmic Vault,
  // reused here rather than reinvented. Guests/subscribers just get the
  // normal Add to Cart card; only an authenticated admin sees edit controls.
  const [isAdmin, setIsAdmin] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    fetch('/api/vault/published')
      .then((res) => res.json())
      .then((data: { products: PublishedVaultProduct[] }) => setVaultProducts(data.products || []))
      .catch((err) => console.error('Failed to load published Vault items:', err));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.app_metadata?.role === 'admin');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(session?.user?.app_metadata?.role === 'admin');
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const allProducts: DisplayProduct[] = [
    ...PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      amount: p.amount,
      isDemo: true,
      imageUrl: p.imageUrls?.[0],
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

  const handleAddToCart = (product: DisplayProduct) => {
    addItem({ productId: product.id, name: product.name, amount: product.amount, imageUrl: product.imageUrl });
    setAddedId(product.id);
    setTimeout(() => setAddedId((current) => (current === product.id ? null : current)), 1500);
  };

  if (detailProduct) {
    return (
      <ProductDetailView
        product={detailProduct}
        isAdmin={isAdmin}
        onBack={() => setDetailProduct(null)}
        onAddToCart={() => handleAddToCart(detailProduct)}
        justAdded={addedId === detailProduct.id}
      />
    );
  }

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
            const canEdit = isAdmin && product.isDemo;
            const isAvailable = getOverride(product.id)?.isAvailable !== false;
            return (
              <div
                key={product.id}
                onClick={() => setDetailProduct(product)}
                className="flex flex-col overflow-hidden transition border rounded-xl bg-[#0B0E14]/80 backdrop-blur-sm border-slate-800 hover:border-slate-700 hover:shadow-[0_0_16px_rgba(255,255,255,0.06)] cursor-pointer"
              >
                <div className="relative flex items-center justify-center overflow-hidden border-b aspect-square bg-slate-900/60 border-slate-800">
                  {product.imageUrl ? (
                    product.imageUrl.endsWith('.mp4') ? (
                      // No autoplay: this whole card's click target opens
                      // the detail modal (see the wrapping div's onClick) —
                      // shows its static first frame instead.
                      <video
                        src={product.imageUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="object-cover w-full h-full pointer-events-none"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- mix of local /public assets and external Printful CDN URLs
                      <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                    )
                  ) : (
                    <Icon className="w-10 h-10 text-slate-600" />
                  )}
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
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailProduct(product);
                        }}
                        className="flex items-center justify-center w-full gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-lg border border-neutral-700 text-white/80 hover:bg-white/10 transition"
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                        Edit Item
                      </button>
                    ) : isAvailable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        className="flex items-center justify-center w-full gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
                      >
                        {addedId === product.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Added
                          </>
                        ) : (
                          'Add to Cart'
                        )}
                      </button>
                    ) : (
                      <span className="flex items-center justify-center w-full px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-lg border border-rose-800 text-rose-400 bg-rose-950/40">
                        Sold Out
                      </span>
                    )}
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
