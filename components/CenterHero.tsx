'use client';

import React, { useState } from 'react';
import CosmicCanvas from './CosmicCanvas';
import type { VaultDrawer } from '@/lib/vaultRegistry';

interface CenterHeroProps {
  onNavigateToVaultDrawer: (drawer: VaultDrawer) => void;
  // Set by LeftNav's Weather/Kali Yuga icons — passed straight through to
  // CosmicCanvas, which actually owns the Weather/Kali sub-view state.
  homeViewRequest?: { view: 'weather' | 'kali'; token: number } | null;
  // Bumped by LeftNav's Home icon — tells CosmicCanvas to drop out of
  // Weather/Kali back to the clock view.
  groundZeroToken?: number;
  // Shows/hides the whole centerpiece (hero title + interactive globe)
  // together — e.g. while the page is showing Pricing instead. Defaults to
  // true so this behaves like an always-on centerpiece unless told
  // otherwise. false unmounts it entirely rather than just hiding it.
  visible?: boolean;
}

export default function CenterHero({
  onNavigateToVaultDrawer,
  homeViewRequest,
  groundZeroToken,
  visible = true,
}: CenterHeroProps) {
  // CosmicCanvas's Weather/Kali sub-views already have their own BackButton
  // — keeping the hero title above them too just stacked a second
  // navigation layer and pushed those views' content down by ~380px with
  // nothing to match it at the bottom. Collapse this chrome once the user
  // is inside one of those; the globe itself (CosmicCanvas) stays mounted
  // and just shows a different internal view.
  const [cosmicView, setCosmicView] = useState<'clock' | 'weather' | 'kali'>('clock');

  if (!visible) return null;

  return (
    <>
      {cosmicView === 'clock' && (
        <div className="relative w-full h-80 flex flex-col items-center justify-center shrink-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-600/20 via-indigo-500/30 to-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/60 via-transparent to-[#070b14]/40" />

          {/* Unboxed — no card/border/background behind the title, floats
              directly over the cosmic canvas layers behind it. */}
          <div className="px-8 py-6 space-y-2 text-center">
            <h1
              className="text-5xl md:text-6xl text-white"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                textShadow: '0 2px 24px rgba(0,0,0,0.6), 0 0 40px rgba(96,165,250,0.25)',
              }}
            >
              Ai One
            </h1>
            <p
              className="font-mono text-xs tracking-widest uppercase md:text-sm text-slate-300"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
            >
              Cosmic Creation & Broadcast Hub
            </p>
          </div>
        </div>
      )}

      {/* Full-bleed so the starfield/space background fills the whole
          viewport instead of sitting inside a bordered, max-width,
          16:9-locked card. */}
      <div className="relative flex-1 w-full min-h-0">
        <CosmicCanvas
          onNavigateToVaultDrawer={onNavigateToVaultDrawer}
          onViewChange={setCosmicView}
          requestedView={homeViewRequest}
          groundZeroToken={groundZeroToken}
        />
      </div>
    </>
  );
}
