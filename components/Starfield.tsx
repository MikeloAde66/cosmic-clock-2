'use client';

import React from 'react';

// Deterministic PRNG (mulberry32) — not Math.random(), since this can be
// server-rendered before hydration and Math.random() would produce a
// different star field on the server than the client, causing a hydration
// mismatch. The same approach CosmicCanvas and StarTrackerView each had
// their own local copy of; this is the single shared version both should
// use instead of duplicating it a third time.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 160;
const randomStar = mulberry32(20260814);
const STARS = Array.from({ length: STAR_COUNT }, () => {
  const twinkles = randomStar() < 0.2;
  return {
    top: `${(randomStar() * 100).toFixed(2)}%`,
    left: `${(randomStar() * 100).toFixed(2)}%`,
    size: `${(1 + randomStar() * 1.5).toFixed(2)}px`,
    opacity: 0.15 + randomStar() * 0.7,
    twinkles,
    delay: `${(randomStar() * 4).toFixed(2)}s`,
    duration: `${(2.5 + randomStar() * 2.5).toFixed(2)}s`,
  };
});

// Mounted once at the app shell level (app/page.tsx) so it sits behind
// every tab — Radio, Cosmic Vault, Pods, Home — rather than each view
// rendering its own separate copy. Pages/cards need a translucent
// background (not fully opaque) for this to actually show through them.
export default function Starfield() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0a0a0c]">
      {STARS.map((star, idx) => (
        <div
          key={idx}
          className={`absolute rounded-full bg-white shadow-[0_0_4px_#ffffff] ${star.twinkles ? 'animate-global-star-twinkle' : ''}`}
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            opacity: star.twinkles ? undefined : star.opacity,
            animationDelay: star.twinkles ? star.delay : undefined,
            animationDuration: star.twinkles ? star.duration : undefined,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes global-star-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.85; transform: scale(1.2); }
        }
        .animate-global-star-twinkle {
          animation-name: global-star-twinkle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
