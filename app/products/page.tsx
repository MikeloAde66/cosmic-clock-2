'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import Starfield from '@/components/Starfield';
import ProductHeroCard from '@/components/ProductHeroCard';
import HardwareProductSlide from '@/components/HardwareProductSlide';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-[560px] overflow-hidden border rounded-2xl border-neutral-800 bg-[#0a0a0c] shadow-2xl">
      {children}
    </div>
  );
}

export default function ProductsPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  // All three slides are hero-image + CTA cards now, not live component
  // previews — Star Tracker's real interactive app still lives at its own
  // /products/star-tracker page, just one tap away via this card's CTA.
  const slides: { key: string; title: string; render: () => React.ReactElement }[] = [
    {
      key: 'star-tracker',
      title: 'Star Tracker',
      render: () => (
        <ProductHeroCard
          heroImageSrc="/images/star-tracker.png"
          heroTagline="See Beyond the Horizon."
          ctaLabel="Explore Specs →"
          ctaHref="/products/star-tracker"
        />
      ),
    },
    ...HARDWARE_PRODUCTS.map((product) => ({
      key: product.id,
      title: product.name,
      render: () => <HardwareProductSlide product={product} />,
    })),
  ];

  const slide = slides[activeIndex];
  const goPrev = () => setActiveIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % slides.length);

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
      <div className="relative z-10 max-w-4xl px-6 py-16 mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            aria-label="Previous slide"
            className="flex items-center justify-center w-9 h-9 transition border rounded-full shrink-0 border-neutral-700 bg-neutral-900/80 hover:border-neutral-500 text-neutral-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 space-y-3">
            <SlideFrame>{slide.render()}</SlideFrame>

            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-sm font-bold text-white">{slide.title}</h2>
            </div>
          </div>

          <button
            onClick={goNext}
            aria-label="Next slide"
            className="flex items-center justify-center w-9 h-9 transition border rounded-full shrink-0 border-neutral-700 bg-neutral-900/80 hover:border-neutral-500 text-neutral-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to ${s.title}`}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-neutral-700 hover:bg-neutral-500'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
