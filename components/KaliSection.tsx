'use client';

import React, { useState } from 'react';
import AiOneChat from './AiOneChat';
import { KaliSpecsButton, KaliSpecsContent } from './KaliSpecsPanel';

// Extracted out of CosmicCanvas.tsx's Kali sub-view so it can also be
// mounted as its own standalone section in the Continuous Stack layout
// (see app/page.tsx) — CosmicCanvas still renders this exact same
// component for its own 'kali' activeView, so Hub/Gallery mode's Kali
// behavior is unchanged.
//
// h-full (not flex-1) so this works both nested in CosmicCanvas's flex
// column (where it's already the only visible child, so h-full resolves
// the same as flex-1 did) and standalone inside a plain min-h-full stack
// section wrapper, which isn't itself a flex container.
export default function KaliSection() {
  const [specsOpen, setSpecsOpen] = useState(false);

  return (
    <div className="relative z-30 flex flex-col w-full h-full min-h-0 p-4">
      <div className="absolute inset-0 z-[5] pointer-events-none bg-gradient-to-b from-transparent via-black/55 to-black/95" />

      {/* max-w-5xl mx-auto matches Radio Central's own container so Kali
          aligns the same way — the full-bleed gradient vignette above
          stays edge-to-edge; only the actual content is constrained. */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-5xl min-h-0 mx-auto">
        <div className="shrink-0">
          <span className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase">Current Epoch</span>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-bold tracking-wider text-white">AI ONE</h2>
            <KaliSpecsButton open={specsOpen} onToggle={() => setSpecsOpen((v) => !v)} />
          </div>
          {specsOpen && <KaliSpecsContent />}
          <p className="text-xs font-mono text-cyan-100 mt-1">YEAR 5,128 / 432,000</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/40">
            <div className="h-full w-[1.18%] bg-cyan-400" />
          </div>
          <span className="mt-1 block text-[9px] font-mono text-cyan-500/70">PROGRESS: 1.1870%</span>

          {/* Standard orthographic projection math, restated here in
              3D spherical-to-Cartesian form as flavor text for the
              Kali Yuga epoch readout. */}
          <div className="mt-3 space-y-1 rounded border border-cyan-500/10 bg-black/40 p-3 font-mono text-[11px] text-cyan-400">
            <div className="text-[10px] uppercase tracking-wider text-cyan-500/70">Orthographic Projection Math</div>
            <div>x = R · cos(lat) · cos(lng)</div>
            <div>y = R · sin(lat)</div>
            <div>z = -R · cos(lat) · sin(lng)</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 pt-3 mt-3 border-t border-cyan-500/20">
          <AiOneChat />
        </div>
      </div>
    </div>
  );
}
