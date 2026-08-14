'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Link as LinkIcon, Lock, Unlock } from 'lucide-react';
import { getOverride, saveOverride, type ProductOverride } from '@/lib/productOverrides';

interface DetailProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  amount: number;
  isDemo: boolean;
  variantBadge?: string;
  imageUrl?: string;
}

interface ProductDetailViewProps {
  product: DetailProduct;
  isAdmin: boolean;
  onBack: () => void;
  onAddToCart: () => void;
  justAdded: boolean;
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

// Canva's documented embed convention (canva.com/help/embed-designs):
// a normal share link becomes embeddable by pointing at its /view path
// with ?embed&meta appended, e.g.
// canva.com/design/DACHZTlgWkU/view?embed&meta — verified against a real
// working example, not guessed. A bare /watch suffix (an earlier guess
// here) is NOT Canva's actual convention and gets blocked by their
// X-Frame-Options: sameorigin header on non-embed pages.
function toCanvaEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('canva.com')) return url;
    if (!parsed.pathname.endsWith('/view')) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/view`;
    }
    parsed.search = 'embed&meta';
    return parsed.toString();
  } catch {
    return url;
  }
}

// Dedicated full-section view (own back arrow, not a stacked modal) —
// reached by clicking any storefront card. Real Vault-origin items are
// still managed through their own admin surface in Cosmic Vault; the
// Canva-link / stock-toggle controls here only apply to the demo Printful
// catalog (product.isDemo), so there's one admin surface per data source
// rather than two competing editors for the same underlying Vault record.
export default function ProductDetailView({ product, isAdmin, onBack, onAddToCart, justAdded }: ProductDetailViewProps) {
  const [override, setOverride] = useState<ProductOverride | undefined>(() => getOverride(product.id));
  const [reelInput, setReelInput] = useState(override?.reelUrl ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  const canEdit = isAdmin && product.isDemo;
  const isAvailable = override?.isAvailable !== false;

  const handleSaveReel = (e: React.FormEvent) => {
    e.preventDefault();
    const next = saveOverride(product.id, { reelUrl: reelInput.trim() || undefined });
    setOverride(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const toggleAvailability = () => {
    const next = saveOverride(product.id, { isAvailable: !isAvailable });
    setOverride(next);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-3xl px-6 py-8 mx-auto space-y-6">
        {/* Labeled distinctly from AiOneHome's own section-level "Back"
            (which leaves Products entirely) — this one only returns to the
            grid, so both buttons stacking on screen read as two different
            levels of navigation rather than a duplicate. */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Products
        </button>

        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{product.category}</span>
          <h2 className="text-2xl font-bold text-white">{product.name}</h2>
          <p className="text-sm text-slate-400">{product.description}</p>
        </div>

        {/* Featured reel — Canva embed when an admin has attached one,
            otherwise a neutral empty state (never a fake/placeholder video). */}
        <div className="overflow-hidden border rounded-xl border-slate-800 bg-slate-900/60">
          {override?.reelUrl ? (
            <div className="relative w-full overflow-hidden aspect-video">
              <iframe
                src={toCanvaEmbedUrl(override.reelUrl)}
                className="absolute inset-0 w-full h-full"
                allow="fullscreen"
                allowFullScreen
                title={`${product.name} featured reel`}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center text-xs font-mono text-slate-600 aspect-video">
              No reel attached yet
            </div>
          )}

          {/* Promo banner — directly below the reel, decorative HUD text
              only; not tied to a real Stripe promotion code. */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-950/80">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-fuchsia-400">
              Limited Release
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
              Use code: <strong className="text-white">1111</strong>
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="p-4 space-y-3 border rounded-xl border-slate-800 bg-slate-900/40">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/70">Admin</span>

            <form onSubmit={handleSaveReel} className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <LinkIcon className="absolute w-3.5 h-3.5 -translate-y-1/2 left-2.5 top-1/2 text-slate-500" />
                <input
                  type="url"
                  value={reelInput}
                  onChange={(e) => setReelInput(e.target.value)}
                  placeholder="Canva share/embed link..."
                  className="w-full py-2 pl-8 pr-3 text-xs font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/50"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200 transition whitespace-nowrap"
              >
                {savedFlash ? <Check className="w-3.5 h-3.5" /> : null}
                {savedFlash ? 'Saved' : 'Add Media Link'}
              </button>
            </form>

            <button
              type="button"
              onClick={toggleAvailability}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide rounded border transition ${
                isAvailable
                  ? 'border-emerald-800 text-emerald-400 bg-emerald-950/40 hover:bg-emerald-950/70'
                  : 'border-rose-800 text-rose-400 bg-rose-950/40 hover:bg-rose-950/70'
              }`}
            >
              {isAvailable ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {isAvailable ? 'In Stock' : 'Sold Out'}
            </button>

            <p className="font-mono text-[10px] text-slate-600">
              Saved to this browser only — not a shared database yet.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <span className="text-2xl font-bold text-white">${formatPrice(product.amount)}</span>
          {!canEdit &&
            (isAvailable ? (
              <button
                type="button"
                onClick={onAddToCart}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
              >
                {justAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Added
                  </>
                ) : (
                  'Add to Cart'
                )}
              </button>
            ) : (
              <span className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide border rounded-lg border-rose-800 text-rose-400 bg-rose-950/40">
                Sold Out
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
