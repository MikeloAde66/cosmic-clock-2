'use client';

import React from 'react';
import { Home } from 'lucide-react';
import AiOneChat from './AiOneChat';
import Starfield from './Starfield';

// Minimalist "Kali" HUD — the "Quantum Oracle"/epoch theming, the side
// telemetry panels, and the avatar artwork are gone per explicit
// instruction; the center of the view is now a plain dark viewport meant
// for live math/equation output, with AiOneChat (unmodified — same real
// greeting, streaming, and speech-to-text button) still doing the actual
// asking/answering underneath it. The viewport itself is a static idle
// placeholder for now — wiring real LaTeX/2D/3D rendering into it needs
// AiOneChat to actually expose its latest message upward, which is a
// separate change from this layout refactor (see summary to the user).
export default function KaliOracleView({ prefillQuery, onGoHome }: KaliOracleViewProps = {}) {
  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden" style={{ background: '#07090E' }}>
      <Starfield contained starCount={220} />
      <div className="absolute inset-0 z-[5] pointer-events-none bg-gradient-to-b from-transparent via-black/40 to-black/90" />

      <div className="relative z-10 flex flex-col w-full h-full min-h-0 p-4">
        {/* Top header row — Home (if provided) + a plain "KALI" label,
            replacing the floating "KALI: QUANTUM ORACLE" / epoch-year pill. */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          {onGoHome ? (
            <button
              type="button"
              onClick={onGoHome}
              aria-label="Home"
              className="flex items-center gap-1.5 h-8 px-3 shrink-0 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </button>
          ) : (
            <div className="w-8" />
          )}

          <p className="text-sm font-bold tracking-[0.3em] text-white">KALI</p>

          <div className="w-8 shrink-0" aria-hidden="true" />
        </div>

        {/* Single centered column now that the side telemetry panels are
            gone — the equation viewport gets the full width up to a
            readable max, instead of being squeezed into the old
            260px_1fr_260px grid's center track. */}
        <div className="flex flex-col flex-1 w-full max-w-4xl min-h-0 gap-4 mx-auto mt-4 overflow-y-auto">
          {/* Live math/equation viewport — solid dark canvas, idle
              placeholder until a real equation/result is wired in. */}
          <div
            className="flex items-center justify-center w-full border shrink-0 rounded-xl min-h-[320px] sm:min-h-[420px]"
            style={{ background: '#0A0B0E', border: '1px solid rgba(0,242,254,0.2)' }}
          >
            <p className="px-6 text-sm text-center font-mono text-slate-500">
              Enter an equation or prompt to execute…
            </p>
          </div>

          {/* AiOneChat, unmodified — real greeting, real streaming, real
              speech-to-text mic button, and the existing SYNTHESIS/
              expand/copy/export toolbar. This is the interactive footer
              the spec asked for; no separate fake input bar. */}
          <div className="flex-1 w-full min-h-0">
            <AiOneChat prefillQuery={prefillQuery} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface KaliOracleViewProps {
  // Threaded down from wherever a real cross-view "Ask Kali" action fires
  // (currently StarTrackerView's tooltip Ask Kali button, via app/page.tsx
  // and CosmicCanvas/CenterHero/AiOneHome for Hub mode, or directly for
  // Stack mode's stack-section-kali). See AiOneChat's own prefillQuery prop.
  prefillQuery?: { text: string; token: number } | null;
  // Optional — only passed from the Hub-mode call site (CosmicCanvas.tsx),
  // not Stack mode's, since "go home" doesn't mean anything in a single
  // continuous-scroll layout. This view has no back button by design
  // (LeftNav's own Home icon is the intended way out — see CosmicCanvas's
  // groundZeroToken comment), but that sidebar is hidden/collapsed on
  // mobile, leaving no way back at all there without this.
  onGoHome?: () => void;
}
