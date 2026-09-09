'use client';

import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import Starfield from '@/components/Starfield';
import StarTrackerHeroCard from '@/components/StarTrackerHeroCard';
import HardwareProductSlide from '@/components/HardwareProductSlide';
import ProductFlipbook, { type FlipbookPage } from '@/components/ProductFlipbook';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

export default function ProductsPage() {
  // Star Tracker PRO gets its own live glassmorphic/typewriter card
  // (StarTrackerHeroCard) instead of the static hero-image + baked-in-CTA
  // convention the hardware slides below still use — its real interactive
  // app lives at /products/star-tracker, just one tap away via this card.
  // Delisted hardware (see hardwareProducts.ts) is filtered out here so
  // it stops appearing in this browsing carousel while its own detail/
  // checkout/thank-you routes stay live for anyone with a direct link.
  const pages: FlipbookPage[] = [
    { key: 'star-tracker', title: 'Star Tracker PRO', render: () => <StarTrackerHeroCard /> },
    ...HARDWARE_PRODUCTS.filter((product) => !product.delisted).map((product) => ({
      key: product.id,
      title: product.name,
      render: () => <HardwareProductSlide product={product} />,
    })),
  ];

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0a0a0c] text-slate-100">
      <Starfield />
      <Link
        href="/"
        aria-label="Home"
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
      >
        <Home className="w-3.5 h-3.5" />
        Home
      </Link>
      <div className="relative z-10 max-w-4xl px-6 py-16 mx-auto">
        <ProductFlipbook pages={pages} />
      </div>
    </div>
  );
}
