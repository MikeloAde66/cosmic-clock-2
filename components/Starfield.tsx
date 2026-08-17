'use client';

import React, { useMemo } from 'react';

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

function buildStars(count: number, seed: number) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const twinkles = random() < 0.2;
    return {
      top: `${(random() * 100).toFixed(2)}%`,
      left: `${(random() * 100).toFixed(2)}%`,
      size: `${(1 + random() * 1.5).toFixed(2)}px`,
      opacity: 0.15 + random() * 0.7,
      twinkles,
      delay: `${(random() * 4).toFixed(2)}s`,
      duration: `${(2.5 + random() * 2.5).toFixed(2)}s`,
    };
  });
}

const DEFAULT_STAR_COUNT = 420;
const DEFAULT_SEED = 20260814;

interface StarfieldProps {
  // Default (false): fixed to the viewport, z-0, opaque background — the
  // one global instance mounted once in app/page.tsx behind every tab.
  // true: absolute instead of fixed, transparent background, no ambient
  // glow of its own — for mounting a second, self-contained instance
  // inside another element (e.g. AiOneHome's hero banner), which already
  // paints its own opaque background and has its own glow blob.
  contained?: boolean;
  // Same defaults as the global instance so a contained instance's stars
  // read as the same field, not a visibly different one — override only
  // to fit a smaller area at proportionally lower density.
  starCount?: number;
  seed?: number;
}

// See the contained prop above for the two ways this gets mounted.
// Pages/cards need a translucent background (not fully opaque) for the
// global instance to actually show through them.
export default function Starfield({ contained = false, starCount = DEFAULT_STAR_COUNT, seed = DEFAULT_SEED }: StarfieldProps) {
  const stars = useMemo(() => buildStars(starCount, seed), [starCount, seed]);

  return (
    <div
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-0 overflow-hidden pointer-events-none ${
        contained ? '' : 'bg-[#0a0a0c]'
      }`}
    >
      {!contained && (
        // Ambient glow — the same deep blue/indigo the "Ai One" hero banner
        // uses (AiOneHome.tsx's own blurred blob), extended into a real
        // radial-gradient across the whole backdrop rather than one small
        // blob, so every tab (not just Home) shares the same soft center
        // luminescence fading into dark space. The header keeps its own
        // dedicated glow blob instead of this one — see contained above.
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(37,99,235,0.16) 0%, rgba(99,102,241,0.10) 40%, transparent 72%)',
          }}
        />
      )}
      {/* Wrapping div (rather than animating each star) — a slow, barely-
          perceptible scale/translate breathing from the viewport center
          reads as drifting slightly forward/backward through the field.
          Uses the exact same keyframe values as CosmicCanvas's own
          animate-cinematic-drift (the main 3D Earth backdrop's slow
          hypnotic camera motion) regardless of contained, so every
          instance of this component moves with matching character. */}
      <div className="w-full h-full animate-starfield-drift">
        {stars.map((star, idx) => (
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
      </div>
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
        @keyframes starfield-drift {
          0%, 100% { transform: scale(1) translate3d(0, 0, 0); }
          50% { transform: scale(1.035) translate3d(-0.6%, 0.4%, 0); }
        }
        .animate-starfield-drift {
          animation: starfield-drift 48s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
