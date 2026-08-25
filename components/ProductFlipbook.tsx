'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FlipbookPage {
  key: string;
  title: string;
  render: () => React.ReactNode;
}

const DURATION_MS = 700;

// Real CSS 3D page-turn (perspective + rotateY + transform-origin: left
// center on each page, see .flipbook-* in globals.css) — not a fade or a
// 2D slider. Each page keeps its own rotateY(0|-180deg); the one page
// actively turning gets a temporary elevated z-index so it visually covers
// the page underneath for the first half of the turn, then disappears via
// backface-visibility once it passes 90deg, revealing what's beneath —
// exactly how a real paper page occludes and un-occludes as it lifts.
export default function ProductFlipbook({ pages }: { pages: FlipbookPage[] }) {
  const [current, setCurrent] = useState(0);
  const [flippingIndex, setFlippingIndex] = useState<number | null>(null);

  function flipTo(target: number) {
    if (flippingIndex !== null || target === current || target < 0 || target > pages.length - 1) return;
    setFlippingIndex(target > current ? current : target);
    setCurrent(target);
    window.setTimeout(() => setFlippingIndex(null), DURATION_MS);
  }

  const goPrev = () => flipTo(current - 1);
  const goNext = () => flipTo(current + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={goPrev}
          aria-label="Previous product"
          disabled={current === 0}
          className="flex items-center justify-center w-9 h-9 transition border rounded-full shrink-0 border-neutral-700 bg-neutral-900/80 hover:border-neutral-500 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flipbook-stage">
            {pages.map((page, i) => {
              const flipped = i < current;
              const z = i === flippingIndex ? 500 : flipped ? 0 : pages.length - i;
              return (
                <div
                  key={page.key}
                  className="flipbook-page"
                  style={{ zIndex: z, transform: `rotateY(${flipped ? -180 : 0}deg)` }}
                >
                  <div className="flipbook-page-face">{page.render()}</div>
                  <div className={`flipbook-page-shade${i === flippingIndex ? ' is-turning' : ''}`} />
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-sm font-bold text-white">{pages[current].title}</h2>
          </div>
        </div>

        <button
          onClick={goNext}
          aria-label="Next product"
          disabled={current === pages.length - 1}
          className="flex items-center justify-center w-9 h-9 transition border rounded-full shrink-0 border-neutral-700 bg-neutral-900/80 hover:border-neutral-500 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        {pages.map((p, i) => (
          <button
            key={p.key}
            onClick={() => flipTo(i)}
            aria-label={`Go to ${p.title}`}
            className={`h-1.5 rounded-full transition-all ${
              i === current ? 'w-6 bg-white' : 'w-1.5 bg-neutral-700 hover:bg-neutral-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
