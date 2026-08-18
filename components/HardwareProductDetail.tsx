'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import Starfield from '@/components/Starfield';
import type { HardwareProduct } from '@/lib/hardwareProducts';

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function HardwareProductDetail({ product }: { product: HardwareProduct }) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 max-w-2xl px-6 py-16 mx-auto space-y-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Hardware
        </Link>

        <div className="space-y-3">
          <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-cyan-300 border rounded border-cyan-500/40 bg-cyan-500/10">
            {product.categoryBadge}
          </span>
          <h1 className="text-3xl font-bold text-white">{product.brandedTitle}</h1>
          <p className="text-sm leading-relaxed text-neutral-400">{product.essence}</p>
        </div>

        <ul className="space-y-2.5">
          {product.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="p-4 text-sm border rounded-lg border-cyan-500/20 bg-cyan-950/10 text-cyan-100">{product.callout}</div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">${formatPrice(product.priceCents)}</span>
            <span className="text-sm text-neutral-500">one-time</span>
          </div>
          <button
            type="button"
            className="w-full py-3 text-sm font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
          >
            {product.preOrderCta}
          </button>
          {product.comingSoon && (
            <p className="text-center text-[11px] font-mono text-slate-500">
              Not yet available for purchase — pre-orders open soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
