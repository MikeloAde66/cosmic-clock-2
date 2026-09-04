'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio as RadioIcon, Mic, LayoutGrid, Umbrella, Sparkles, Telescope, Newspaper, ArrowUpRight } from 'lucide-react';
import { useNoaaSnapshot } from '@/lib/useNoaaSnapshot';
import WeatherForecastOverlay from './WeatherForecastOverlay';
import { useKaliPendingApprovals } from '@/lib/useKaliPendingApprovals';
import QuantumApprovalModal from './kali/QuantumApprovalModal';

interface GalleryGridProps {
  onOpenRadio: () => void;
  onOpenPods: () => void;
  onOpenKali: () => void;
  onOpenStarTracker: () => void;
  onOpenLetsChat: () => void;
  weatherActive?: boolean;
}

// Canonical asset paths — real filenames per the explicit mapping given for
// the actual gallery source images. Drop each file into public/gallery/
// under its target name and the matching card picks it up automatically:
// it fades in on top of the gradient cover below, no further code changes
// needed. Weather has no source image in the mapping (it gets a live NOAA
// feed instead, see WeatherCardImage below), so it keeps the plain
// icon-only card body.
//
const GALLERY_IMAGES = {
  radio: '/gallery/radio.png',
  studio: '/gallery/studio.png',
  kali: '/gallery/kali.png',
  starTracker: '/gallery/star-tracker.png',
  productsCatalog: '/gallery/products-catalog.png',
  communityHub: '/gallery/community.png',
} as const;

// Per-card gradient covers — a concrete, finished-looking visual for every
// slot from the very first paint, rather than an empty/blurred frame while
// the real public/gallery/ photos are staged. Colors echo each feature's
// own accent elsewhere in the app (cyan for radio, violet for Kali, etc.)
// rather than being generic. Pure CSS + the icon already imported for that
// card — no external image requests, so nothing to fail or hotlink.
const CARD_GRADIENTS: Record<string, string> = {
  radio: 'linear-gradient(135deg, #22d3ee 0%, #0e7490 55%, #082f49 100%)',
  studio: 'linear-gradient(135deg, #c084fc 0%, #7e22ce 55%, #2e1065 100%)',
  starTracker: 'linear-gradient(135deg, #7dd3fc 0%, #1d4ed8 55%, #0f172a 100%)',
  kali: 'linear-gradient(135deg, #f0abfc 0%, #9333ea 55%, #1e1b4b 100%)',
  productsCatalog: 'linear-gradient(135deg, #cbd5e1 0%, #475569 55%, #0f172a 100%)',
  communityHub: 'linear-gradient(135deg, #fb7185 0%, #be123c 55%, #4c0519 100%)',
};

// Stagger offset between each card's arrival — 180ms sits in the
// requested 150-200ms window.
const ARRIVAL_STAGGER_MS = 180;

const cardClass =
  'group relative flex flex-col justify-between w-full h-full p-5 text-left border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-slate-600 hover:bg-slate-900/60 transition-all min-h-[240px] overflow-hidden';

// Radio Central's own border variant — cyan-tinted per the live waveform
// inside it, instead of the neutral slate every other card uses.
const cardClassRadio =
  'group relative flex flex-col justify-between w-full h-full p-5 text-left border rounded-2xl border-cyan-500/20 bg-slate-900/40 backdrop-blur-md hover:border-cyan-400/40 hover:bg-slate-900/60 transition-all min-h-[240px] overflow-hidden';

// Fixed per-bar profile (no Math.random()) — a random height per render
// would disagree between the server-rendered HTML and the client's first
// render and flash as a hydration-mismatch reflow the instant React
// hydrates. The sine-based heights and modulo'd duration/delay still read
// as organic rather than a flat, mechanical repeat.
//
// .toFixed(4) on all three — confirmed via a real dev-server hydration
// warning that the *values* here were already deterministic (same
// Math.sin(i...) both sides), but the raw floats' string serialization
// wasn't: the server rendered height as "74.5691%" while the client's
// in-memory string was the full "74.56910727401733%", and delay similarly
// came back as "-1.14s" vs "-1.1400000000000001s" - same underlying
// number, different string once round-tripped through the browser's own
// attribute parsing. Rounding to a fixed number of decimals up front
// collapses both sides to the identical string. Same class of bug (and
// same fix) as the Star Tracker card's radar-tick lines elsewhere in
// this file.
const RADIO_WAVEFORM_BARS = Array.from({ length: 32 }, (_, i) => ({
  height: Number((22 + 70 * Math.abs(Math.sin(i * 0.85 + 1))).toFixed(4)),
  duration: Number((0.8 + (i % 5) * 0.18).toFixed(4)),
  // Negative delays start each bar mid-cycle rather than all 32 launching
  // from zero in lockstep on mount, so it reads as already-in-progress
  // playback instead of a synchronized twitch.
  delay: Number((-((i % 7) * 0.19)).toFixed(4)),
}));

// Radio Central's preview strip — a live-looking glowing waveform instead
// of the static gallery photo every other card fades in (see CardImage).
// Same gradient/dot-texture/icon-watermark base as CardImage, so it still
// reads as part of the same card family.
function RadioWaveformCardImage() {
  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0" style={{ background: CARD_GRADIENTS.radio }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
          backgroundSize: '16px 16px',
        }}
      />
      <RadioIcon className="absolute w-20 h-20 -right-3 -bottom-5 text-white/20" />
      <div className="radio-waveform-scan" />
      <div className="absolute inset-x-0 bottom-0 flex items-end h-16 gap-[2px] px-3 pb-1.5">
        {RADIO_WAVEFORM_BARS.map((bar, i) => (
          <span
            key={i}
            className="flex-1 min-w-[2px] rounded-t-sm radio-waveform-bar bg-cyan-200 shadow-[0_0_6px_rgba(103,232,249,0.85)]"
            style={{
              height: `${bar.height}%`,
              animationDuration: `${bar.duration}s`,
              animationDelay: `${bar.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const MATRIX_RAIN_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MATRIX_RAIN_FONT_SIZE = 14;
// Throttles how often a new row of glyphs drops, independent of display
// refresh rate — without this, a 120Hz display would rain twice as fast as
// a 60Hz one for no visual benefit, just wasted draws.
const MATRIX_RAIN_FRAME_INTERVAL_MS = 65;

// Products card's preview strip — a canvas-driven Matrix-style digital
// rain instead of the static gallery photo every other card fades in (see
// CardImage). Width/height are cached from ResizeObserver, not read
// inside the draw loop itself, so the animation never forces a layout
// read on every frame — the loop only touches canvas pixels.
function MatrixRainCardImage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];

    function resize() {
      // clientWidth/clientHeight (the layout box), not
      // getBoundingClientRect (the transformed/rendered box) — this card
      // mounts inside ArrivalSlot's scale(0.05) -> scale(1) entrance
      // animation, and getBoundingClientRect briefly returns that
      // animation's tiny in-progress size if read before it settles.
      // ResizeObserver won't catch that later either, since CSS transforms
      // never change an element's own layout dimensions.
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.max(1, Math.floor(width / MATRIX_RAIN_FONT_SIZE));
      // Staggered starting offsets (including negative ones) so columns
      // don't all begin — or later reset — in lockstep.
      drops = Array.from({ length: columns }, () => Math.random() * -30);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    let lastDraw = 0;

    function draw(timestamp: number) {
      rafId = requestAnimationFrame(draw);
      if (timestamp - lastDraw < MATRIX_RAIN_FRAME_INTERVAL_MS) return;
      lastDraw = timestamp;

      // A translucent wipe (rather than clearRect) is what leaves the
      // fading trail behind each falling glyph — the classic digital-rain
      // technique, entirely from compositing, no per-glyph fade tracking.
      ctx!.shadowBlur = 0;
      ctx!.fillStyle = 'rgba(2, 6, 23, 0.2)';
      ctx!.fillRect(0, 0, width, height);

      ctx!.font = `${MATRIX_RAIN_FONT_SIZE}px monospace`;
      ctx!.textBaseline = 'top';
      ctx!.shadowColor = 'rgba(52, 211, 153, 0.9)';
      ctx!.shadowBlur = 6;
      ctx!.fillStyle = 'rgba(110, 231, 183, 0.9)';

      for (let i = 0; i < columns; i++) {
        const char = MATRIX_RAIN_CHARSET[Math.floor(Math.random() * MATRIX_RAIN_CHARSET.length)];
        const x = i * MATRIX_RAIN_FONT_SIZE;
        const y = drops[i] * MATRIX_RAIN_FONT_SIZE;
        ctx!.fillText(char, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i] += 1;
        }
      }
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#020617]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

const STUDIO_GRID_LINE_COUNT = 9;
const STUDIO_GRID_VANISH_Y_RATIO = 0.32;
// Depth units per millisecond, not per tick — frame-rate independent, so
// the drift speed stays consistent regardless of the throttle below.
const STUDIO_GRID_SPEED_PER_MS = 0.00035;
const STUDIO_GRID_PERSPECTIVE_POWER = 2.4;
const STUDIO_NODE_COUNT = 7;
const STUDIO_FRAME_INTERVAL_MS = 33;

// Studio One's preview strip — a canvas-driven "4D content creator" scene:
// an infinite perspective grid drifting toward the viewer (the classic
// recycled-depth-line technique, same idea as a synthwave/Tron floor) with
// floating glowing nodes drifting above it. Blue/violet/white accents
// only — no amber/gold, per this project's standing "zero yellow" rule
// (see feedback_zero-yellow-crisp-white memory), which explicitly named
// this card back when it was called Pods.
function StudioPreviewCardImage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let gridLines: { depth: number }[] = [];
    let nodes: { x: number; baseY: number; phase: number; speed: number; color: string }[] = [];

    function resize() {
      // clientWidth/clientHeight, not getBoundingClientRect — see the
      // identical note in MatrixRainCardImage's resize() above; this card
      // mounts inside the same ArrivalSlot scale-in animation.
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      gridLines = Array.from({ length: STUDIO_GRID_LINE_COUNT }, (_, i) => ({ depth: i / STUDIO_GRID_LINE_COUNT }));
      const nodeColors = ['rgba(240, 245, 255, 0.95)', 'rgba(196, 181, 253, 0.9)', 'rgba(103, 232, 249, 0.9)'];
      nodes = Array.from({ length: STUDIO_NODE_COUNT }, (_, i) => ({
        x: ((i + 0.5) / STUDIO_NODE_COUNT) * width + Math.sin(i * 3.1) * width * 0.04,
        baseY: height * (0.14 + 0.5 * Math.abs(Math.sin(i * 1.7))),
        phase: i * 1.3,
        speed: 0.0009 + (i % 3) * 0.0003,
        color: nodeColors[i % nodeColors.length],
      }));
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    let lastDraw = 0;

    function draw(timestamp: number) {
      rafId = requestAnimationFrame(draw);
      if (timestamp - lastDraw < STUDIO_FRAME_INTERVAL_MS) return;
      const dt = lastDraw ? timestamp - lastDraw : 16;
      lastDraw = timestamp;

      ctx!.shadowBlur = 0;
      ctx!.fillStyle = '#020617';
      ctx!.fillRect(0, 0, width, height);

      const vanishX = width / 2;
      const vanishY = height * STUDIO_GRID_VANISH_Y_RATIO;

      // Converging vertical lines — a static fan from the vanishing point,
      // the perspective "landscape" structure the horizontal lines below
      // fly along.
      ctx!.strokeStyle = 'rgba(96, 165, 250, 0.18)';
      ctx!.lineWidth = 1;
      const fanSpread = width * 0.9;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const bottomX = vanishX + (t - 0.5) * 2 * fanSpread;
        ctx!.beginPath();
        ctx!.moveTo(vanishX, vanishY);
        ctx!.lineTo(bottomX, height);
        ctx!.stroke();
      }

      // Horizontal depth lines — each drifts from the horizon toward the
      // viewer and recycles back once it passes, an infinite grid that
      // loops seamlessly since a recycled line is indistinguishable from
      // one that was always there.
      for (const line of gridLines) {
        line.depth += STUDIO_GRID_SPEED_PER_MS * dt;
        if (line.depth > 1) line.depth -= 1;
        const y = vanishY + (height - vanishY) * Math.pow(line.depth, STUDIO_GRID_PERSPECTIVE_POWER);
        const alpha = 0.05 + line.depth * 0.35;
        ctx!.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx!.lineWidth = 0.5 + line.depth * 1.5;
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
        ctx!.stroke();
      }

      // Floating glowing nodes — "3D matrix elements" drifting above the
      // grid, with faint connecting lines between nearby ones for a
      // network/node-graph feel.
      const positions = nodes.map((node) => ({
        x: node.x,
        y: node.baseY + Math.sin(timestamp * node.speed + node.phase) * (height * 0.06),
      }));
      ctx!.strokeStyle = 'rgba(196, 181, 253, 0.15)';
      ctx!.lineWidth = 1;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          if (dist < width * 0.28) {
            ctx!.beginPath();
            ctx!.moveTo(positions[i].x, positions[i].y);
            ctx!.lineTo(positions[j].x, positions[j].y);
            ctx!.stroke();
          }
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        ctx!.shadowColor = nodes[i].color;
        ctx!.shadowBlur = 6;
        ctx!.fillStyle = nodes[i].color;
        ctx!.beginPath();
        ctx!.arc(positions[i].x, positions[i].y, 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#020617]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

// Fixed positions (index-based trig, no Math.random()) — same reasoning as
// RADIO_WAVEFORM_BARS above: a random value per render would disagree
// between the server-rendered HTML and the client's first render and
// throw a hydration mismatch the instant React takes over.
const STAR_TRACKER_MINI_STARS = Array.from({ length: 10 }, (_, i) => ({
  top: `${(Math.abs(Math.sin(i * 2.3)) * 88).toFixed(1)}%`,
  left: `${(Math.abs(Math.cos(i * 1.7)) * 96).toFixed(1)}%`,
  size: 1 + (i % 3),
  delay: -((i % 5) * 0.5),
  duration: 2 + (i % 4) * 0.5,
}));
const STAR_TRACKER_MINI_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
const STAR_TRACKER_MINI_TARGETS = [
  { x: 68, y: 40 },
  { x: 35, y: 62 },
  { x: 58, y: 66 },
];

// Star Tracker's preview strip — a miniature version of the real
// sub-page's holographic radar dome (components/StarTrackerView.tsx),
// not a generic/unrelated radar look: obsidian dome, cyan double ring,
// tick marks, a center crosshair, a few tracked-object dots, and the same
// rotating sweep motif. Pure SVG + CSS transform, no canvas/rAF needed —
// see star-tracker-mini-sweep in globals.css.
function StarTrackerRadarCardImage() {
  const center = 50;
  const radius = 34;
  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#050810]">
      {STAR_TRACKER_MINI_STARS.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white gallery-star-twinkle"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            boxShadow: '0 0 4px #ffffff',
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        <circle cx={center} cy={center} r={radius} fill="rgba(2,6,23,0.85)" stroke="rgba(34,211,238,0.3)" strokeWidth={1} />
        <circle cx={center} cy={center} r={radius * 0.5} fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth={1} />
        {/* Center crosshair — the dome's "zenith" marker on the real page. */}
        <line x1={center - 4} y1={center} x2={center + 4} y2={center} stroke="rgba(34,211,238,0.6)" strokeWidth={1} />
        <line x1={center} y1={center - 4} x2={center} y2={center + 4} stroke="rgba(34,211,238,0.6)" strokeWidth={1} />
        {/* Azimuth ring ticks — majors every 90°, same convention as the
            real page's compass ring, just without labels at this scale. */}
        {STAR_TRACKER_MINI_TICKS.map((deg) => {
          const angle = (deg - 90) * (Math.PI / 180);
          const isMajor = deg % 90 === 0;
          const outer = radius + (isMajor ? 5 : 3);
          const inner = radius + (isMajor ? 1 : 1);
          // .toFixed(4) — trig output can differ in the last bit between
          // server and client (different CPU/engine float paths), which
          // React's dev-mode hydration check flags as a mismatch on every
          // hydration; rounding collapses both sides to the same string
          // well within any real architecture-level difference. Same
          // guard already used above for STAR_TRACKER_MINI_STARS.
          return (
            <line
              key={deg}
              x1={(center + Math.cos(angle) * outer).toFixed(4)}
              y1={(center + Math.sin(angle) * outer).toFixed(4)}
              x2={(center + Math.cos(angle) * inner).toFixed(4)}
              y2={(center + Math.sin(angle) * inner).toFixed(4)}
              stroke={isMajor ? 'rgba(103,232,249,0.8)' : 'rgba(34,211,238,0.4)'}
              strokeWidth={isMajor ? 1.2 : 0.6}
            />
          );
        })}
        {/* Tracked-object dots — decorative telemetry targets, not real data. */}
        {STAR_TRACKER_MINI_TARGETS.map((t, i) => (
          <circle
            key={i}
            cx={t.x}
            cy={t.y}
            r={1.6}
            fill="#67e8f9"
            style={{ filter: 'drop-shadow(0 0 2px rgba(34,211,238,0.9))' }}
          />
        ))}
        {/* Rotating highlight sweep — same technique as the real page's
            azimuth ring: a short dash on a big circle, spun via CSS. */}
        <g className="star-tracker-mini-sweep">
          <circle
            cx={center}
            cy={center}
            r={radius + 4}
            fill="none"
            stroke="rgba(103,232,249,0.9)"
            strokeWidth={2}
            strokeDasharray={`${(radius + 4) * 0.2} ${(radius + 4) * 6.08}`}
          />
        </g>
      </svg>
    </div>
  );
}

const DIGITAL_MAGAZINE_TICKER_TEXT = 'Welcome to the Digital Digest. Where Ancient Wisdom meets Technology';

// Digital Magazine's preview strip — a continuous marquee ticker on a
// solid black background. The content is duplicated exactly once and the
// track is translated by exactly -50% (of its own, content-driven width,
// via w-max — never a hardcoded pixel guess) — since the second copy is
// identical to the first, the loop point at -50% is visually
// indistinguishable from 0%, which is what makes it seamless rather than
// visibly resetting.
function DigitalMagazineTickerCardImage() {
  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-black">
      <div className="absolute inset-0 flex items-center">
        <div className="flex w-max whitespace-nowrap digital-magazine-ticker-track">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="px-16 text-sm font-semibold tracking-wide text-white"
              style={{ textShadow: '0 0 8px rgba(255,255,255,0.35)' }}
            >
              {DIGITAL_MAGAZINE_TICKER_TEXT}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Real quantum-mechanics notation, not decorative symbol soup: the
// time-dependent Schrodinger equation, a qubit state vector in bra-ket
// notation, and the time-independent (eigenvalue) form. Cycled one at a
// time, typed out, held long enough to actually read, then cleared.
const KALI_EQUATIONS = ['iħ ∂ψ/∂t = Ĥψ', '|ψ⟩ = α|0⟩ + β|1⟩', 'Ĥ|ψ⟩ = E|ψ⟩'];
const KALI_TYPE_CHAR_MS = 95;
const KALI_HOLD_MS = 1800;
const KALI_CLEAR_PAUSE_MS = 500;

// Kali's preview strip — a deliberate, line-by-line typewriter reveal of
// real quantum notation on solid black, with a soft cyan holographic glow
// (see KaliOracleView.tsx's own note: gold/amber was considered for this
// exact card and dropped for the project's standing zero-amber rule, so
// this reuses that same resolved color instead of reopening it) and a
// gentle, continuous vertical drift.
function KaliQuantumEquationCardImage() {
  const [equationIndex, setEquationIndex] = useState(0);
  const [displayedLength, setDisplayedLength] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const fullText = KALI_EQUATIONS[equationIndex % KALI_EQUATIONS.length];

    function typeChar(len: number) {
      if (cancelled) return;
      if (len <= fullText.length) {
        setDisplayedLength(len);
        timeoutId = setTimeout(() => typeChar(len + 1), KALI_TYPE_CHAR_MS);
        return;
      }
      // Fully typed — hold so it's actually readable, not rushed, then
      // clear and advance to the next equation.
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setDisplayedLength(0);
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setEquationIndex((i) => (i + 1) % KALI_EQUATIONS.length);
        }, KALI_CLEAR_PAUSE_MS);
      }, KALI_HOLD_MS);
    }
    typeChar(0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [equationIndex]);

  const fullText = KALI_EQUATIONS[equationIndex % KALI_EQUATIONS.length];

  return (
    <div className="relative flex items-center justify-center w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-black">
      <div
        className="px-4 font-mono text-base tracking-wide text-center kali-equation-drift metallic-gold-text"
        style={{ textShadow: '0 0 8px rgba(212,175,55,0.45), 0 0 18px rgba(184,134,11,0.28)' }}
      >
        {fullText.slice(0, displayedLength)}
        <span className="kali-equation-cursor" style={{ color: '#f5d576', textShadow: '0 0 6px rgba(212,175,55,0.6)' }}>
          |
        </span>
      </div>
    </div>
  );
}

// Preview strip — a finished-looking gradient cover (see CARD_GRADIENTS)
// plus a faint star-dot texture and an oversized icon watermark render
// immediately, so every card shows a concrete, rich visual from the first
// paint. The real photo from public/gallery/ fades in on top the moment it
// loads; until then (or if it 404s) the gradient cover is the whole show,
// not a fallback that reads as "missing."
function CardImage({ src, gradient, Icon }: { src: string; gradient: string; Icon: typeof ArrowUpRight }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // A cached image (very likely on repeat visits/reloads) can finish
  // loading before React ever attaches the onLoad listener below, so the
  // browser never fires 'load' again and the photo stays stuck at
  // opacity-0, showing only the gradient cover underneath as if the real
  // photo were missing. This ref-callback checks img.complete the instant
  // the element mounts, covering the case onLoad alone misses.
  const checkAlreadyLoaded = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  };

  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0" style={{ background: gradient }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
          backgroundSize: '16px 16px',
        }}
      />
      <Icon className="absolute w-20 h-20 -right-3 -bottom-5 text-white/20" />
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={checkAlreadyLoaded}
          src={src}
          alt=""
          className={`relative object-cover w-full h-full transition-opacity duration-500 ${
            loaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

// Real, public NOAA GOES-16 GeoColor feed — the same CDN URL NoaaWidget
// (mounted hidden elsewhere, see CosmicCanvas.tsx) already uses for its own
// satellite view. No API key, refreshed by NOAA itself; a plain <img> (not
// next/image) so there's no remote-domain allowlist to configure.
const NOAA_SATELLITE_URL = 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/1250x750.jpg';

// Weather's own preview strip — live satellite imagery instead of a
// gradient cover, with the live current temperature (useNoaaSnapshot,
// same NWS points->forecastHourly pattern NoaaWidget already proved out)
// overlaid in the corner once it resolves.
function WeatherCardImage() {
  const { temp, unit, loading } = useNoaaSnapshot();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950">
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={NOAA_SATELLITE_URL}
          alt=""
          className={`relative object-cover w-full h-full transition-opacity duration-500 ${
            loaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!loading && temp != null && (
        <div className="absolute px-2 py-0.5 text-xs font-bold font-mono text-white rounded bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm">
          {temp}°{unit}
        </div>
      )}
    </div>
  );
}

// Fixed node layout for the Automation Pipeline card — a compact stand-in
// for a real n8n-style workflow diagram (incoming call -> spam check ->
// branch -> AI-handled response), not a literal reproduction: at 220x96
// there's no room for readable labels, so each stage is a distinct shape
// (circle = trigger, rounded rect = process, diamond = decision) instead.
const AUTOMATION_NODES: { x: number; y: number; shape: 'circle' | 'rect' | 'diamond' }[] = [
  { x: 20, y: 48, shape: 'circle' },
  { x: 62, y: 48, shape: 'rect' },
  { x: 104, y: 48, shape: 'diamond' },
  { x: 150, y: 48, shape: 'rect' },
  { x: 196, y: 48, shape: 'rect' },
];
const AUTOMATION_PATH = AUTOMATION_NODES.map((n, i) => `${i === 0 ? 'M' : 'L'}${n.x},${n.y}`).join(' ');
// Node delays spaced evenly across the dot's travel duration so each one
// lights up right as the traveling pulse passes it (see automation-node-pulse
// in globals.css) rather than glowing on its own unrelated schedule.
const AUTOMATION_DUR_S = 3.6;
const AUTOMATION_NODE_DELAYS = AUTOMATION_NODES.map((_, i) =>
  Number(((i / AUTOMATION_NODES.length) * AUTOMATION_DUR_S).toFixed(4))
);

// Automation Pipeline card's preview strip — fills the old Ai One Core
// slot until a real n8n workflow product exists here (see GalleryGrid
// below). A single glowing dot rides the node path on a native SVG
// <animateMotion> loop (cheaper and simpler than canvas/rAF for one dot),
// with each node pulsing in sequence so the whole thing reads as a workflow
// actually running end-to-end, not a static wiring diagram.
function AutomationFlowCardImage() {
  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#050810]">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
          backgroundSize: '16px 16px',
        }}
      />
      <svg viewBox="0 0 220 96" className="absolute inset-0 w-full h-full">
        {/* Main pipeline edges. */}
        <path d={AUTOMATION_PATH} fill="none" stroke="rgba(129,140,248,0.35)" strokeWidth={1.5} />
        {/* Decision branch stub off the diamond node — a dead-end "log it"
            offshoot, purely to read as a real Yes/No branch like the
            reference automation, not a literal reconnecting path. */}
        <path
          d={`M104,48 L104,20 L136,20`}
          fill="none"
          stroke="rgba(129,140,248,0.25)"
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
        <rect x={136} y={14} width={20} height={12} rx={2} fill="rgba(15,23,42,0.9)" stroke="rgba(165,180,252,0.5)" strokeWidth={1} className="automation-branch-flash" />

        {AUTOMATION_NODES.map((node, i) => (
          <g key={i} className="automation-node-pulse" style={{ animationDuration: `${AUTOMATION_DUR_S}s`, animationDelay: `${AUTOMATION_NODE_DELAYS[i]}s` }}>
            {node.shape === 'circle' && (
              <circle cx={node.x} cy={node.y} r={7} fill="rgba(30,27,75,0.9)" stroke="#a5b4fc" strokeWidth={1.5} />
            )}
            {node.shape === 'rect' && (
              <rect x={node.x - 8} y={node.y - 7} width={16} height={14} rx={3} fill="rgba(30,27,75,0.9)" stroke="#a5b4fc" strokeWidth={1.5} />
            )}
            {node.shape === 'diamond' && (
              <rect
                x={node.x - 7}
                y={node.y - 7}
                width={14}
                height={14}
                fill="rgba(30,27,75,0.9)"
                stroke="#a5b4fc"
                strokeWidth={1.5}
                transform={`rotate(45 ${node.x} ${node.y})`}
              />
            )}
          </g>
        ))}

        {/* Faint trailing dot, slightly behind the lead dot — a cheap comet
            trail with no per-frame trail tracking. */}
        <circle r={2} fill="#67e8f9" opacity={0.4}>
          <animateMotion path={AUTOMATION_PATH} dur={`${AUTOMATION_DUR_S}s`} begin="-0.15s" repeatCount="indefinite" />
        </circle>
        <circle r={3} fill="#a5f3fc" style={{ filter: 'drop-shadow(0 0 5px rgba(103,232,249,0.95))' }}>
          <animateMotion path={AUTOMATION_PATH} dur={`${AUTOMATION_DUR_S}s`} repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

// Holographic Lab card's preview strip — fills the old HydroNode Builder
// Kit slot until real merch exists here. A pulsing containment-field orb:
// concentric field rings expand and fade outward (see holo-ring-pulse in
// globals.css) around a glowing core, with a rotating dashed ring (reusing
// star-tracker-mini-sweep's rotate keyframe — same technique, different
// center) and a soft vertical scan sweep on top.
function HolographicLabCardImage() {
  const cx = 110;
  const cy = 48;
  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-black">
      <svg viewBox="0 0 220 96" className="absolute inset-0 w-full h-full">
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={16 + i * 12}
            ry={8 + i * 6}
            fill="none"
            stroke="rgba(94,234,212,0.7)"
            strokeWidth={1}
            className="holo-ring-pulse"
            style={{ animationDuration: '2.8s', animationDelay: `${i * 0.7}s` }}
          />
        ))}
        <g className="star-tracker-mini-sweep" style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: '9s' }}>
          <circle cx={cx} cy={cy} r={30} fill="none" stroke="rgba(94,234,212,0.55)" strokeWidth={1.5} strokeDasharray="4 10" />
        </g>
        <circle cx={cx} cy={cy} r={9} fill="#0f766e" stroke="#5eead4" strokeWidth={1.5} className="holo-orb-glow" />
      </svg>
      <div className="holo-scan-sweep" />
    </div>
  );
}

function CardHeader({ Icon, active }: { Icon: typeof RadioIcon; active?: boolean }) {
  return (
    <div className="flex items-start justify-between">
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-lg border ${
          active ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-300 bg-slate-950/60'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <ArrowUpRight className="w-4 h-4 transition-opacity opacity-0 text-slate-500 group-hover:opacity-100" />
    </div>
  );
}

// One grid slot — the glassmorphic skeleton frame is rendered immediately
// (so the 3x3 grid's shape is locked in from the first paint) and stays
// visible, pulsing, behind whichever card hasn't arrived yet. The card
// itself travels in on its own delay and is pointer-events-none/cursor-wait
// until its arrival animation actually finishes (onAnimationEnd), so it
// can't be clicked mid-flight.
function ArrivalSlot({ index, docked, onDock, children }: { index: number; docked: boolean; onDock: (i: number) => void; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[240px]">
      <div
        className={`absolute inset-0 rounded-2xl border border-slate-800/40 bg-white/5 backdrop-blur-md transition-opacity duration-300 ${
          docked ? 'opacity-0' : 'opacity-100 animate-pulse'
        }`}
      />
      <div
        className={`gallery-card-arrival absolute inset-0 ${docked ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none cursor-wait'}`}
        style={{ animationDelay: `${index * ARRIVAL_STAGGER_MS}ms` }}
        onAnimationEnd={() => onDock(index)}
      >
        {children}
      </div>
    </div>
  );
}

// Layout 2 (Gallery Grid) — a dashboard-style entry point into the app's
// real sections, not fabricated placeholder content. Radio/Pods/Kali/Star
// Tracker/Digital Magazine land you in the dedicated Classic Hub
// view/overlay for that section (this is a launcher, not a place to cram
// full players/chat into tiny tiles); Products is a real route; Weather is
// a direct action (no standalone view at all — see
// lib/useWeatherLocation.ts — so its card just opens the same inline footer
// search the umbrella icon does, without leaving Gallery mode). Digital
// Magazine opens the Media Flow & Audio Center (TenForwardSection) — a real
// waveform visualizer + Webamp launcher wired to RadioPlayerContext, not
// the community forum this slot used to hold. The former Ai One Core and
// HydroNode Builder Kit hardware listings are gone (no real inventory
// existed yet — see lib/hardwareProducts.ts); their two slots are
// non-interactive animated previews (Automations, Merch) reserving the
// grid's shape until real products land there.
export default function GalleryGrid({
  onOpenRadio,
  onOpenPods,
  onOpenKali,
  onOpenStarTracker,
  onOpenLetsChat,
  weatherActive,
}: GalleryGridProps) {
  // One flag per grid slot — flips true once that slot's arrival animation
  // finishes (see ArrivalSlot's onAnimationEnd below), which is also what
  // switches the card from pointer-events-none/cursor-wait to clickable.
  const [docked, setDocked] = useState<boolean[]>(() => Array(9).fill(false));
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  // Only ever polls anything for a signed-in admin — see the hook itself.
  const { isAdmin, approvals: pendingApprovals, refetch: refetchApprovals } = useKaliPendingApprovals();
  const dock = (i: number) => setDocked((prev) => (prev[i] ? prev : prev.map((v, idx) => (idx === i ? true : v))));

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Hero — max-w-5xl mx-auto matches the card grid below so both
          align at the same edges instead of the banner bleeding wider. */}
      <div className="flex flex-col items-center justify-center max-w-5xl gap-2 px-4 pt-14 pb-10 mx-auto text-center">
        <h1
          className="text-4xl text-white md:text-5xl"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            textShadow: '0 2px 24px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.25)',
          }}
        >
          Ai One
        </h1>
        <p className="font-mono text-xs tracking-widest uppercase text-zinc-300">Cosmic Creation &amp; Broadcast Hub</p>
      </div>

      {/* 9-card grid — perspective on the grid itself is what gives each
          slot's translateZ arrival real depth instead of a flat scale. */}
      <div
        className="grid max-w-5xl grid-cols-1 gap-4 px-4 pb-14 mx-auto sm:grid-cols-2 lg:grid-cols-3"
        style={{ perspective: '1200px' }}
      >
        <ArrivalSlot index={0} docked={docked[0]} onDock={dock}>
          <button onClick={onOpenRadio} className={cardClassRadio}>
            <RadioWaveformCardImage />
            <CardHeader Icon={RadioIcon} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Radio Central</div>
              <p className="mt-1 text-xs text-slate-400">Live streaming stations, curated ambient/cosmic channels.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={1} docked={docked[1]} onDock={dock}>
          <button onClick={onOpenPods} className={cardClass}>
            <StudioPreviewCardImage />
            <CardHeader Icon={Mic} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Studio One</div>
              <p className="mt-1 text-xs text-slate-400">Your track library, uploads, and playlists.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={2} docked={docked[2]} onDock={dock}>
          <button onClick={onOpenStarTracker} className={cardClass}>
            <StarTrackerRadarCardImage />
            <CardHeader Icon={Telescope} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Star Tracker</div>
              <p className="mt-1 text-xs text-slate-400">Live orbital tracking and pass predictions.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={3} docked={docked[3]} onDock={dock}>
          <button onClick={() => setShowWeatherOverlay(true)} className={cardClass}>
            <WeatherCardImage />
            <CardHeader Icon={Umbrella} active={weatherActive} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Weather</div>
              <p className="mt-1 text-xs text-slate-400">Search a ZIP, city, or address for a live NOAA forecast.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={4} docked={docked[4]} onDock={dock}>
          <div className="relative w-full h-full">
            <button onClick={onOpenKali} className={cardClass}>
              <KaliQuantumEquationCardImage />
              <CardHeader Icon={Sparkles} />
              <div className="mt-4">
                <div className="text-sm font-bold text-white">Ai One</div>
                <p className="mt-1 text-xs text-slate-400">Ancient technology, quantum physics, epoch cycles.</p>
              </div>
            </button>
            {/* Admin-only notification badge for pending real-QPU approvals
                (see aws/README.md) — a separate control from the card's own
                button (which opens Kali chat), not nested inside it. */}
            {isAdmin && pendingApprovals.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowApprovalModal(true);
                }}
                aria-label={`${pendingApprovals.length} pending quantum task approval${pendingApprovals.length === 1 ? '' : 's'}`}
                className="absolute z-20 flex items-center justify-center w-6 h-6 text-[10px] font-bold text-black bg-cyan-400 rounded-full top-3 right-3 animate-pulse hover:animate-none shadow-[0_0_10px_rgba(34,211,238,0.8)]"
              >
                {pendingApprovals.length}
              </button>
            )}
          </div>
        </ArrivalSlot>

        <ArrivalSlot index={5} docked={docked[5]} onDock={dock}>
          <Link href="/products" className={cardClass}>
            <MatrixRainCardImage />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Products</div>
              <p className="mt-1 text-xs text-slate-400">Hardware and kits — browse the full catalog.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={6} docked={docked[6]} onDock={dock}>
          {/* Non-interactive — no hardware product lives at this slot
              anymore (see lib/hardwareProducts.ts), so there's nowhere to
              link to yet. The animated pipeline keeps the slot's shape and
              activity on the grid until a real n8n-style workflow product
              replaces it. */}
          <div className={`${cardClass} cursor-default hover:border-slate-800/80 hover:bg-slate-900/40`}>
            <AutomationFlowCardImage />
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center border rounded-lg w-9 h-9 border-slate-700 text-slate-300 bg-slate-950/60">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded border-slate-700 text-slate-500">
                Coming Soon
              </span>
            </div>
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Automations</div>
              <p className="mt-1 text-xs text-slate-400">n8n-style workflow automations — reserved slot, live preview for now.</p>
            </div>
          </div>
        </ArrivalSlot>

        <ArrivalSlot index={7} docked={docked[7]} onDock={dock}>
          {/* Non-interactive for the same reason as the Automations slot
              above — HydroNode Builder Kit's hardware listing is gone, this
              is a reserved slot for merch. */}
          <div className={`${cardClass} cursor-default hover:border-slate-800/80 hover:bg-slate-900/40`}>
            <HolographicLabCardImage />
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center border rounded-lg w-9 h-9 border-slate-700 text-slate-300 bg-slate-950/60">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded border-slate-700 text-slate-500">
                Coming Soon
              </span>
            </div>
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Merch</div>
              <p className="mt-1 text-xs text-slate-400">Reserved slot, live preview for now.</p>
            </div>
          </div>
        </ArrivalSlot>

        <ArrivalSlot index={8} docked={docked[8]} onDock={dock}>
          <button onClick={onOpenLetsChat} className={cardClass}>
            <DigitalMagazineTickerCardImage />
            <CardHeader Icon={Newspaper} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Digital Magazine</div>
              <p className="mt-1 text-xs text-slate-400">Media Flow &amp; Audio Center — waveform visualizer, Webamp, and every stream.</p>
            </div>
          </button>
        </ArrivalSlot>
      </div>

      {showWeatherOverlay && <WeatherForecastOverlay onClose={() => setShowWeatherOverlay(false)} />}
      {showApprovalModal && (
        <QuantumApprovalModal
          approvals={pendingApprovals}
          onClose={() => setShowApprovalModal(false)}
          onDecided={refetchApprovals}
        />
      )}
    </div>
  );
}
