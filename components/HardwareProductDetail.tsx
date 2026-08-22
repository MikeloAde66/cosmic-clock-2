'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Play } from 'lucide-react';
import Starfield from '@/components/Starfield';
import ProductTelemetryDemo from '@/components/ProductTelemetryDemo';
import type { HardwareProduct } from '@/lib/hardwareProducts';

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function HardwareProductDetail({ product }: { product: HardwareProduct }) {
  const [videoRequested, setVideoRequested] = useState(false);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <div className="relative z-10 max-w-4xl px-6 py-16 mx-auto space-y-10">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Hardware
        </Link>

        {/* Hero: image alongside headline/price/CTA, stacked on mobile */}
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="relative w-full h-80 overflow-hidden border rounded-xl border-slate-800 bg-[#0B0E14]">
            {product.videoSrc ? (
              videoRequested ? (
                <video
                  src={product.videoSrc}
                  poster={product.heroImageSrc}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 object-contain w-full h-full"
                />
              ) : (
                <button
                  onClick={() => setVideoRequested(true)}
                  aria-label={`Play ${product.brandedTitle} preview video`}
                  className="absolute inset-0 w-full h-full group"
                >
                  <Image
                    src={product.heroImageSrc}
                    alt={product.heroTagline}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center transition-colors bg-black/20 group-hover:bg-black/35">
                    <span className="flex items-center justify-center border rounded-full w-14 h-14 bg-white/90 border-white/20 shadow-lg group-hover:bg-white">
                      <Play className="w-5 h-5 ml-0.5 text-black" fill="currentColor" />
                    </span>
                  </div>
                </button>
              )
            ) : (
              <Image src={product.heroImageSrc} alt={product.heroTagline} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" />
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-cyan-300 border rounded border-cyan-500/40 bg-cyan-500/10">
                {product.categoryBadge}
              </span>
              <h1 className="text-3xl font-bold text-white">
                {product.brandedTitle} <span className="text-cyan-300">– {product.heroTagline}</span>
              </h1>
              <p className="text-sm leading-relaxed text-neutral-400">{product.essence}</p>
            </div>

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
                  Digital platform — no physical shipping required. Not yet available for purchase; pre-orders open soon.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Compact interactive demo — hydronode-pro/builder-kit get the
            water variant, aione-core gets the quantum variant. Every other
            product routed through this shared component (there are only
            these three) renders neither; Star Tracker never reaches this
            component at all. */}
        {(product.id === 'hydronode-pro' || product.id === 'builder-kit') && <ProductTelemetryDemo variant="water" />}
        {product.id === 'aione-core' && <ProductTelemetryDemo variant="quantum" />}

        {/* Specifications & Bill of Materials */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Specifications & Bill of Materials</h2>
          {product.bom ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {product.bom.map((item) => (
                <div key={item.label} className="p-3 border rounded-lg border-slate-800 bg-slate-900/40">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">{item.label}</div>
                  <p className="mt-1 text-sm text-slate-300">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 text-sm border rounded-lg border-cyan-500/20 bg-cyan-950/10 text-cyan-100">{product.callout}</div>
      </div>
    </div>
  );
}
