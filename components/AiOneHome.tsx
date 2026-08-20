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

// The ambient "Space Dust" event's 16 soft cloud puffs — positions/sizes
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

// A second, finer-grained layer of "grit" specks that fires alongside the
// same event/timing as the soft puffs above — small, mostly-unblurred blue/
// purple points instead of large soft blobs, so the event reads as detailed
// drifting grit on top of the ambient glow rather than pure blur.
const SPACE_DUST_GRIT_COUNT = 50;
const randomGrit = mulberry32(20260820);
const GRIT_COLORS = ['rgba(165,180,252,0.9)', 'rgba(196,181,253,0.85)', 'rgba(147,197,253,0.8)'];
const SPACE_DUST_GRIT = Array.from({ length: SPACE_DUST_GRIT_COUNT }, () => ({
  left: `${(randomGrit() * 100).toFixed(2)}%`,
  top: `${(randomGrit() * 100).toFixed(2)}%`,
  size: `${(1 + randomGrit() * 2).toFixed(2)}px`,
  delay: `${(randomGrit() * 1.2).toFixed(2)}s`,
  driftX: `${((randomGrit() - 0.5) * 140).toFixed(1)}px`,
  driftY: `${((randomGrit() - 0.5) * 140).toFixed(1)}px`,
  color: GRIT_COLORS[Math.floor(randomGrit() * GRIT_COLORS.length)],
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
  // Mirrors CenterHero/CosmicCanvas's own activeView — used only to hide
  // the photographic shadow-slide background (mountain/planet hero image)
  // outside the clock view, so Weather/Kali sit on the plain procedural
  // starfield/sky layers instead.
  const [cosmicView, setCosmicView] = useState<'clock' | 'weather' | 'kali'>('clock');

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
    <div className="home-page relative z-10 w-full h-full overflow-hidden text-slate-100 flex flex-col font-sans">
      {/* Layers 1-2: independent starfield and shadow-slideshow (see
          .home-page rules in app/globals.css) — sit behind Layer 4's content
          below. The old Layer 0 (4-hour cascading sky gradient) was removed
          entirely — its rose/magenta stops were bleeding through into
          Weather/Kali whenever this container's real content overflow
          (from the dust-puff layer, since fixed) let it scroll into view;
          the starfield/shadow-slide carry the background on their own now.
          overflow-hidden (not overflow-y-auto) since nothing here is meant
          to scroll at this level — AiOneChat owns its own message-list
          scroll internally. */}
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
        {SPACE_DUST_GRIT.map((g, i) => (
          <span
            key={i}
            className="dust-grit"
            style={{
              left: g.left,
              top: g.top,
              width: g.size,
              height: g.size,
              background: g.color,
              color: g.color,
              animationDelay: g.delay,
              ['--dust-drift-x' as string]: g.driftX,
              ['--dust-drift-y' as string]: g.driftY,
            } as React.CSSProperties}
          />
        ))}
      </div>
      {/* Photographic hero image — clock view only. Weather/Kali sit on
          the plain procedural sky/star/dust layers above instead, per the
          "clean, unified dark starfield, no mountain/planet image" request
          for those two sub-views. */}
      {activeSection === 'home' && cosmicView === 'clock' && (
        <div className="shadow-slideshow-container">
          <div className="shadow-slide" />
        </div>
      )}

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
          onCosmicViewChange={setCosmicView}
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
