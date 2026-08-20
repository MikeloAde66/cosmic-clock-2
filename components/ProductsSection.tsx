'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

// A Continuous Stack section for Products — real product data (same
// lib/hardwareProducts.ts the actual /products page uses), not the literal
// /products route component itself. That page mounts its own <Starfield />
// and an absolutely-positioned Home link sized for owning the whole
// viewport as a standalone route; embedding it verbatim here would double
// up the starfield canvas and misplace that link inside a stacked section.
// This is a real teaser grid instead, linking out to each product's real
// detail page (and to /products itself for the full browsing experience).
const TEASER_PRODUCTS = [
  { id: 'star-tracker', name: 'Star Tracker', tagline: 'See Beyond the Horizon.', heroImageSrc: '/images/star-tracker.png' },
  ...HARDWARE_PRODUCTS.map((p) => ({ id: p.id, name: p.name, tagline: p.heroTagline, heroImageSrc: p.heroImageSrc })),
];

export default function ProductsSection() {
  return (
    <div className="w-full px-4 py-16">
      <div className="flex items-end justify-between max-w-5xl mx-auto mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Products</h2>
          <p className="mt-1 text-sm text-slate-400">Hardware and kits from the Ai One catalog.</p>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide text-cyan-400 hover:text-cyan-300"
        >
          View All <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid max-w-5xl grid-cols-1 gap-4 mx-auto sm:grid-cols-2 lg:grid-cols-4">
        {TEASER_PRODUCTS.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}`}
            className="relative overflow-hidden border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-slate-600 transition-all group"
          >
            <div className="relative w-full overflow-hidden aspect-square bg-black/40">
              <Image
                src={p.heroImageSrc}
                alt={p.name}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 25vw"
              />
            </div>
            <div className="p-4">
              <div className="text-sm font-bold text-white">{p.name}</div>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">{p.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
