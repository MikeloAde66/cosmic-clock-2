'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import CenterHero from './CenterHero';
import PricingPlans from './PricingPlans';
import type { VaultDrawer } from '@/lib/vaultRegistry';

// Deterministic PRNG (mulberry32) — same rationale as Starfield/CosmicCanvas's
// own local copies: this can be server-rendered before hydration, and
// Math.random() would produce a different puff layout on the server than the
// client, causing a hydration mismatch.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The ambient "Space Dust" event's 12-20 soft cloud puffs — positions/sizes
// are fixed per puff (same set reused every time the event fires); only
// *when* it fires and its 6s fade curve are handled by JS/CSS below.
const SPACE_DUST_PUFF_COUNT = 16;
const randomDust = mulberry32(20260819);
const SPACE_DUST_PUFFS = Array.from({ length: SPACE_DUST_PUFF_COUNT }, () => ({
  left: `${(randomDust() * 100).toFixed(2)}%`,
  top: `${(randomDust() * 100).toFixed(2)}%`,
  size: `${(150 + randomDust() * 170).toFixed(0)}px`,
  delay: `${(randomDust() * 0.8).toFixed(2)}s`,
  driftX: `${((randomDust() - 0.5) * 80).toFixed(1)}px`,
  driftY: `${((randomDust() - 0.5) * 80).toFixed(1)}px`,
}));

interface AiOneHomeProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
  // Set by LeftNav's Weather/Kali Yuga icons — forces this back to its main
  // 'home' section (in case the user was on Products/Pricing/Cart) and
  // passes the request through to CosmicCanvas, which actually owns the
  // Weather/Kali sub-view state.
  homeViewRequest?: { view: 'weather' | 'kali'; token: number } | null;
  // Bumped by LeftNav's Home icon (see page.tsx's groundZeroToken) — resets
  // this back to its main 'home' section AND tells CosmicCanvas to drop out
  // of Weather/Kali back to the clock view, since those no longer have
  // their own Back button.
  groundZeroToken?: number;
  // Bumped by page.tsx when the URL carries ?checkout=cancelled or
  // ?checkout=required (Stripe's cancel_url, or /dashboard bouncing a
  // signed-in visitor with no active plan back here) — jumps straight to
  // the Pricing section instead of leaving them stranded on Home.
  pricingRequestToken?: number;
}

export default function AiOneHome({
  onNavigateToVaultDrawer,
  homeViewRequest,
  groundZeroToken,
  pricingRequestToken,
}: AiOneHomeProps) {
  const [activeSection, setActiveSection] = useState<'home' | 'pricing'>('home');

  // Which of the 3 shadow-slide images is current — JS-driven instead of a
  // pure CSS @keyframes loop so the first slide can render already at full
  // opacity on mount (a class present from the initial render never fires
  // its CSS transition; only a later change to it does), while switches
  // between slides still get a snappy transition. Same 45min hold per
  // slide as the CSS version this replaced — only the fade itself sped up.
  const [activeShadowSlide, setActiveShadowSlide] = useState(0);
  useEffect(() => {
    const SLIDE_HOLD_MS = 45 * 60 * 1000;
    const id = setInterval(() => {
      setActiveShadowSlide((i) => (i + 1) % 3);
    }, SLIDE_HOLD_MS);
    return () => clearInterval(id);
  }, []);

  // Ambient "Space Dust" event — fires roughly every 30min (randomized
  // offset so it never feels mechanically on-the-dot), stays active for
  // exactly 6s, then self-reschedules. The .active class toggle here just
  // starts/stops a single 6s CSS animation (see .dust-event/.dust-puff in
  // globals.css) that owns the actual fade in/hold/fade out curve.
  const [dustEventActive, setDustEventActive] = useState(false);
  useEffect(() => {
    const BASE_INTERVAL_MS = 30 * 60 * 1000;
    const JITTER_MS = 10 * 60 * 1000; // randomized offset -> 20-40min range
    const EVENT_DURATION_MS = 6000;

    let activeTimeoutId: ReturnType<typeof setTimeout>;
    let scheduleTimeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = BASE_INTERVAL_MS + (Math.random() * 2 - 1) * JITTER_MS;
      scheduleTimeoutId = setTimeout(() => {
        setDustEventActive(true);
        activeTimeoutId = setTimeout(() => {
          setDustEventActive(false);
          scheduleNext();
        }, EVENT_DURATION_MS);
      }, delay);
    };
    scheduleNext();

    return () => {
      clearTimeout(scheduleTimeoutId);
      clearTimeout(activeTimeoutId);
    };
  }, []);

  // A LeftNav Weather/Kali click can arrive while this is showing Pricing —
  // snap back to the main section so CosmicCanvas (which owns the actual
  // sub-view) is mounted to receive the request.
  useEffect(() => {
    if (homeViewRequest) queueMicrotask(() => setActiveSection('home'));
  }, [homeViewRequest]);

  useEffect(() => {
    if (groundZeroToken) queueMicrotask(() => setActiveSection('home'));
  }, [groundZeroToken]);

  useEffect(() => {
    if (pricingRequestToken) queueMicrotask(() => setActiveSection('pricing'));
  }, [pricingRequestToken]);

  return (
    <div className="home-page relative z-10 w-full h-full overflow-y-auto text-slate-100 flex flex-col font-sans">
      {/* Layers 0-2: the 4-hour cascading sky, independent starfield, and
          shadow-slideshow (see .home-page rules in app/globals.css) — all
          sit behind Layer 4's content below. CosmicCanvas (the Earth Hub
          globe) still has its own opaque background and isn't touched, so
          these layers are only visible through the hero banner/sub-nav's
          translucent chrome above them, not through the globe view. */}
      <div className="sky-layer" />
      <div className="star-layer" />
      <div className="dust-layer" />
      <div className={`dust-event${dustEventActive ? ' active' : ''}`}>
        {SPACE_DUST_PUFFS.map((p, i) => (
          <span
            key={i}
            className="dust-puff"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              ['--dust-drift-x' as string]: p.driftX,
              ['--dust-drift-y' as string]: p.driftY,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="shadow-slideshow-container">
        <div className={`shadow-slide${activeShadowSlide === 0 ? ' active' : ''}`} />
        <div className={`shadow-slide${activeShadowSlide === 1 ? ' active' : ''}`} />
        <div className={`shadow-slide${activeShadowSlide === 2 ? ' active' : ''}`} />
      </div>

      {/* Layer 4: everything interactive/foreground, lifted toward the
          viewer via translateZ(30px) per the layer architecture. CenterHero
          (hero title + interactive globe) unmounts entirely whenever
          Pricing is showing instead — see its own visible prop. */}
      <div className="content-layer flex flex-col flex-1 min-h-0">
        <CenterHero
          onNavigateToVaultDrawer={onNavigateToVaultDrawer}
          homeViewRequest={homeViewRequest}
          groundZeroToken={groundZeroToken}
          visible={activeSection === 'home'}
        />

        {activeSection !== 'home' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-4 shrink-0">
              <button
                onClick={() => setActiveSection('home')}
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {activeSection === 'pricing' && <PricingPlans />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
