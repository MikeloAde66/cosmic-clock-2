'use client';

import React, { useState } from 'react';
import { Check, Droplets, Wrench } from 'lucide-react';
import type { HardwareProduct } from '@/lib/hardwareProducts';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'builder-kit': Wrench,
  'hydronode-pro': Droplets,
};

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

// Real <img src> pointed at the path the product data names — the moment a
// real photo lands at that path in public/, it just renders. Until then
// onError swaps in a labeled icon placeholder instead of a broken-image
// glyph, so the reserved slot stays honest about not having art yet.
function CoverImageSlot({ product }: { product: HardwareProduct }) {
  const [failed, setFailed] = useState(false);
  const Icon = ICONS[product.id] ?? Wrench;

  return (
    <div
      className={`relative flex items-center justify-center w-full h-40 overflow-hidden rounded-xl border shrink-0 bg-[#0B0E14] ${
        product.featured ? 'border-white/60' : 'border-slate-700'
      }`}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.coverImageSrc} alt={product.name} onError={() => setFailed(true)} className="object-cover w-full h-full" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-600">
          <Icon className="w-10 h-10" />
          <span className="font-mono text-[9px] uppercase tracking-wide">Image placeholder — {product.coverImageSrc}</span>
        </div>
      )}
    </div>
  );
}

export default function HardwareProductSlide({ product }: { product: HardwareProduct }) {
  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="max-w-md mx-auto space-y-4">
        <CoverImageSlot product={product} />

        <div className="space-y-2 text-center">
          <span className="inline-block px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide text-slate-300 border rounded border-slate-700 bg-slate-900/80">
            {product.badge}
          </span>
          <h3 className="text-base font-bold leading-snug text-white">{product.headline}</h3>
        </div>

        <p className="text-sm text-center text-slate-400">{product.description}</p>

        <div
          className={`p-4 space-y-3 border rounded-xl bg-[#0B0E14]/80 ${
            product.featured ? 'border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.12)]' : 'border-slate-800'
          }`}
        >
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold text-white">${formatPrice(product.priceCents)}</span>
            <span className="text-xs text-slate-500">one-time</span>
          </div>

          <ul className="space-y-1.5">
            {product.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 mt-0.5 text-white/70 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={product.comingSoon}
            title={product.comingSoon ? 'Not available for purchase yet' : undefined}
            className={`w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg transition ${
              product.comingSoon
                ? 'bg-slate-900/60 border border-neutral-800 text-white/30 cursor-not-allowed'
                : product.featured
                  ? 'bg-white text-black hover:bg-neutral-200'
                  : 'bg-slate-900/60 border border-neutral-700 text-white/80 hover:border-neutral-500 hover:text-white hover:bg-white/10'
            }`}
          >
            {product.comingSoon ? 'Coming Soon' : `Select ${product.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
