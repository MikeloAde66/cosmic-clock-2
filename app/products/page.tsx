'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Starfield from '@/components/Starfield';
import StarTrackerView from '@/components/StarTrackerView';
import HardwareProductSlide from '@/components/HardwareProductSlide';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

// A `transform` on an ancestor establishes a new containing block for any
// `position: fixed` descendant (CSS spec, not a hack) — StarTrackerView's
// root is `fixed inset-0` (a real fullscreen overlay when opened normally
// from TopHeader), so without this it would break out of its slide frame
// and cover the whole page instead of previewing inside it. `scale(1)` is
// visually a no-op; it exists purely for that containment side effect.
function LiveFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-[560px] overflow-hidden border rounded-2xl border-neutral-800 bg-[#0a0a0c] shadow-2xl">
      <div className="absolute inset-0 w-full h-full" style={{ transform: 'scale(1)' }}>
        {children}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Star Tracker is a real component, mounted live — not a screenshot. Only
  // the active slide is ever mounted, so switching slides doesn't leave
  // anything heavy running in the background. The two hardware slides are
  // pre-launch placeholders (see lib/hardwareProducts.ts) rather than live
  // previews of a running feature.
  const slides: { key: string; title: string; render: () => React.ReactElement; cta?: boolean }[] = [
    {
      key: 'star-tracker',
      title: 'Star Tracker',
      render: () => <StarTrackerView onBack={() => {}} />,
      cta: true,
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
            <LiveFrame>{slide.render()}</LiveFrame>

            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-sm font-bold text-white">{slide.title}</h2>
              {slide.cta && (
                <Link
                  href="/products/star-tracker"
                  className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
                >
                  Explore Standalone App →
                </Link>
              )}
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
