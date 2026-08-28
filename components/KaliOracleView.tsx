'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Home } from 'lucide-react';
import AiOneChat from './AiOneChat';
import Starfield from './Starfield';
import { KaliSpecsButton, KaliSpecsContent } from './KaliSpecsPanel';

// Full-screen "Kali: Quantum Oracle" HUD — a visual wrapper around the
// exact same real pieces KaliSection.tsx already uses (the real epoch/
// progress readout, KaliSpecsButton/Content, and AiOneChat itself,
// unmodified — same component, same hooks, same real speech-to-text
// button, same real greeting message). Nothing about the chat logic is
// forked or reimplemented here.
//
// The right-column status pills (QUANTUM SYNC, AKASHIC LINK, etc.) and
// "RESONANCE 98.7%" are decorative thematic flavor text, not real
// telemetry — consistent with how KaliSection already presents "YEAR
// 5,128 / 432,000" and the epoch progress bar as cosmological world-
// building rather than literal system diagnostics. Nothing here claims a
// real measurement that doesn't exist (unlike the fabricated "98% AI
// listener match" / live-listener-count metrics declined elsewhere in
// this app, which were presented as real product analytics).
//
// Uses cyan/white accents only — the original spec called for
// "cyan/gold," but gold/amber conflicts with this app's standing
// zero-amber design rule.
const STATUS_MARKERS = ['AWARENESS', 'HARMONY', 'ALIGNMENT'];
const RIGHT_INDICATORS = ['QUANTUM SYNC', 'DATA WEAVE', 'AKASHIC LINK', 'ORACLE MODE', 'PRESENCE LOCK'];

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

export default function KaliOracleView({ prefillQuery, onGoHome }: KaliOracleViewProps = {}) {
  const [specsOpen, setSpecsOpen] = useState(false);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden" style={{ background: '#07090E' }}>
      <Starfield contained starCount={220} />
      <div className="absolute inset-0 z-[5] pointer-events-none bg-gradient-to-b from-transparent via-black/40 to-black/90" />

      <div className="relative z-10 flex flex-col w-full h-full min-h-0 p-4">
        {onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            aria-label="Home"
            className="absolute z-20 flex items-center gap-1.5 h-8 px-3 top-4 left-4 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
        )}

        {/* Top header badge */}
        <div className="flex justify-center shrink-0">
          <div
            className="px-5 py-2 text-center border rounded-full"
            style={{ background: 'rgba(11,16,29,0.8)', border: '1px solid rgba(0,242,254,0.3)', boxShadow: '0 0 20px rgba(0,242,254,0.15)' }}
          >
            <p className="text-xs font-bold tracking-[0.3em] text-white">AI ONE: QUANTUM ORACLE</p>
            <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/80">Year 5,128 / 432,000</p>
          </div>
        </div>

        {/* Main grid — side telemetry columns flank the centered avatar */}
        {/* overflow-y-auto - confirmed via real measurement that on a
            mobile viewport (grid-cols-1 stacks all three columns
            vertically) this grid's real content (664px) exceeds its
            allocated height (502px), and the root's own overflow-hidden
            (needed to contain the Starfield/gradient background) left
            that overflow completely unreachable - the AiOneChat input at
            the bottom was cut off with no way to scroll to it. */}
        <div className="grid flex-1 grid-cols-1 gap-4 mt-4 min-h-0 overflow-y-auto lg:grid-cols-[260px_1fr_260px]">
          {/* Left column — the real epoch/progress/specs content from KaliSection */}
          <div className="order-2 overflow-y-auto lg:order-1">
            <div
              className="p-3 space-y-3 border rounded-xl"
              style={{ background: 'rgba(11,16,29,0.6)', border: '1px solid rgba(0,242,254,0.2)' }}
            >
              <span className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase">Current Epoch</span>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold tracking-wider text-white">AI ONE</h2>
                <KaliSpecsButton open={specsOpen} onToggle={() => setSpecsOpen((v) => !v)} />
              </div>
              {specsOpen && <KaliSpecsContent />}
              <p className="text-xs font-mono text-cyan-100">YEAR 5,128 / 432,000</p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-black/40">
                <div className="h-full w-[1.18%] bg-cyan-400" />
              </div>
              <span className="block text-[9px] font-mono text-cyan-500/70">PROGRESS: 1.1870%</span>

              <div className="pt-2 space-y-1.5 border-t border-cyan-500/10">
                {STATUS_MARKERS.map((label) => (
                  <div key={label} className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
                    <span className="text-slate-500">{label}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,242,254,0.8)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center — avatar centerpiece with ambient glow. No mask (it
              was cutting into the torso/hands last round) — mix-blend-mode:
              screen, now applied directly to the <img> itself rather than
              a wrapping div, drops the image's dark background (it has no
              real alpha channel) against this equally-dark page, while the
              gold/cyan highlights stay fully visible. A slight scale-up
              plus overflow-hidden on the container crops the burned-in
              text on the image's left/right margins without touching the
              torso/hands, which sit centered in the frame. */}
          <div className="relative flex flex-col items-center order-1 min-h-0 lg:order-2">
            <div className="relative w-full max-w-2xl h-[420px] mt-2 overflow-hidden shrink-0 sm:h-[600px]">
              <span
                className="absolute inset-0 m-auto rounded-full avatar-glow-pulse w-2/3 h-2/3"
                style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.5), rgba(168,85,247,0.25) 55%, transparent 75%)' }}
              />
              <Image
                src="/images/kali-avatar.png"
                alt="Ai One"
                fill
                sizes="(max-width: 640px) 100vw, 672px"
                className="object-cover"
                style={{ objectPosition: 'center 35%', transform: 'scale(1.25)', mixBlendMode: 'screen' }}
              />
            </div>

            {/* AiOneChat, unmodified — real greeting, real streaming, real
                speech-to-text mic button. This is the interactive footer
                the spec asked for; no separate fake input bar. */}
            <div className="flex-1 w-full min-h-0 mt-4">
              <AiOneChat prefillQuery={prefillQuery} />
            </div>
          </div>

          {/* Right column — decorative thematic status (see file header comment) */}
          <div className="order-3 overflow-y-auto">
            <div
              className="p-3 space-y-3 border rounded-xl"
              style={{ background: 'rgba(11,16,29,0.6)', border: '1px solid rgba(0,242,254,0.2)' }}
            >
              <div className="flex justify-center">
                <SacredGeometryEmblem />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-center text-cyan-400/80">
                Core Frequency: 432 Hz
              </p>
              <div className="pt-2 space-y-1.5 border-t border-cyan-500/10">
                {RIGHT_INDICATORS.map((label) => (
                  <div key={label} className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
                    <span className="text-slate-500">{label}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,242,254,0.8)]" />
                  </div>
                ))}
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
                  <span className="text-slate-500">Resonance</span>
                  <span className="text-cyan-300">98.7%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes avatarGlowPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .avatar-glow-pulse {
          animation: avatarGlowPulse 3.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Simple decorative sacred-geometry emblem (Flower-of-Life-style
// overlapping circles) built from plain SVG — not a functional element,
// purely thematic like the rest of the right column.
function SacredGeometryEmblem() {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return { cx: 32 + Math.cos(angle) * 14, cy: 32 + Math.sin(angle) * 14 };
  });
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="14" stroke="rgba(0,242,254,0.5)" strokeWidth="1" />
      {points.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="14" stroke="rgba(0,242,254,0.3)" strokeWidth="1" />
      ))}
    </svg>
  );
}
