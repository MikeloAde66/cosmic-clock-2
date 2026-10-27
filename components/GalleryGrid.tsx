'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio as RadioIcon, ArrowUpRight, Lock } from 'lucide-react';
import { useNoaaSnapshot } from '@/lib/useNoaaSnapshot';
import WeatherForecastOverlay from './WeatherForecastOverlay';
import { useKaliPendingApprovals } from '@/lib/useKaliPendingApprovals';
import QuantumApprovalModal from './kali/QuantumApprovalModal';

interface GalleryGridProps {
  onOpenPods: () => void;
  onOpenLetsChat: () => void;
  weatherActive?: boolean;
}

// Per-card gradient covers — a concrete, finished-looking visual for every
// slot from the very first paint, rather than an empty/blurred frame while
// the real public/gallery/ photos are staged. Colors echo each feature's
// own accent elsewhere in the app (fire for radio, violet for Kali, etc.)
// rather than being generic. Pure CSS + the icon already imported for that
// card — no external image requests, so nothing to fail or hotlink.
const CARD_GRADIENTS: Record<string, string> = {
  // Radio Central burns: ember-dark at the top, heating to orange at the base.
  radio: 'radial-gradient(120% 90% at 50% 115%, #f97316 0%, #c2410c 30%, #7f1d1d 60%, #1c0705 100%)',
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
  'group relative flex flex-col justify-between w-full h-full p-5 text-left border rounded-2xl border-orange-500/25 bg-slate-900/40 backdrop-blur-md hover:border-orange-400/50 hover:bg-slate-900/60 transition-all min-h-[240px] overflow-hidden';

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
// Each bar is a flame: deep red at the base through orange and gold to a
// white-hot tip.
const RADIO_FIRE_BAR = 'linear-gradient(to top, #991b1b 0%, #ea580c 38%, #f59e0b 64%, #fde047 84%, #fffbeb 100%)';

function RadioWaveformCardImage() {
  return (
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0" style={{ background: CARD_GRADIENTS.radio }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(254,215,170,0.9) 1px, transparent 1.5px)',
          backgroundSize: '16px 16px',
        }}
      />
      <RadioIcon className="absolute w-20 h-20 -right-3 -bottom-5 text-amber-100/20" />
      <div className="radio-waveform-scan" />
      <div className="absolute inset-x-0 bottom-0 flex items-end h-16 gap-[2px] px-3 pb-1.5">
        {RADIO_WAVEFORM_BARS.map((bar, i) => (
          <span
            key={i}
            className="flex-1 min-w-[2px] rounded-t-sm radio-waveform-bar shadow-[0_0_8px_rgba(251,146,60,0.9)]"
            style={{
              background: RADIO_FIRE_BAR,
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
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#020617]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

// A card's preview strip as a muted, looping video clip. Each clip is cut
// to loop without a visible seam or a fade to black, so it plays as one
// steady scene. Plays inline on phones; viewers who ask for reduced
// motion get the still poster frame instead. The poster also sits behind
// the video as the strip's background, so it never shows blank.
function LoopVideoCardImage({ name }: { name: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#020617] bg-cover bg-center"
      style={{ backgroundImage: `url(/media/${name}.jpg)` }}
    >
      {reduceMotion ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/${name}.jpg`} alt="" className="absolute inset-0 object-cover w-full h-full" />
      ) : (
        <video
          poster={`/media/${name}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="absolute inset-0 object-cover w-full h-full"
        >
          <source src={`/media/${name}.webm`} type="video/webm" />
          <source src={`/media/${name}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

// Studio One: a slow pan through an AI research lab.
function StudioPreviewCardImage() {
  return <LoopVideoCardImage name="studio-lab" />;
}

// Star Tracker PRO: the glowing gold "Ai" emblem turning in place.
function StarTrackerCardImage() {
  return <LoopVideoCardImage name="star-ai" />;
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
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden bg-black shrink-0">
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
    <div className="relative flex items-center justify-center w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden bg-black shrink-0">
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
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950">
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

// Flight School: a drone holding a steady hover over open fields, on a
// 5-second loop that restarts on the still photo behind it.
function FlightSchoolCardImage() {
  return <LoopVideoCardImage name="flight-drone" />;
}

// Astro Simulator: a still picture of a spacecraft cockpit looking down on
// Earth. Decorative illustration, not a live view.
function AstroSimCardImage() {
  return (
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#020617]">
      <img src="/media/astro-cockpit.jpg" alt="" className="absolute inset-0 object-cover w-full h-full" />
    </div>
  );
}

// Top row of a card: just the "open" arrow in the corner (shown on hover).
// The weather card's arrow stays visible and turns green while its live
// forecast overlay is on.
function CardHeader({ active }: { active?: boolean }) {
  return (
    <div className="flex items-start justify-end h-9">
      <ArrowUpRight
        className={`w-4 h-4 transition-opacity ${
          active ? 'opacity-100 text-green-400' : 'opacity-0 text-slate-500 group-hover:opacity-100'
        }`}
      />
    </div>
  );
}

// One grid slot — the glassy skeleton frame is rendered immediately
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
// waveform visualizer + audio player launcher wired to RadioPlayerContext,
// not the community forum this slot used to hold. The former Ai One Core and
// HydroNode Builder Kit hardware listings are gone (no real inventory
// existed yet — see lib/hardwareProducts.ts); their two slots are
// non-interactive animated previews (workflow automation, merchandise)
// reserving the grid's shape until real products land there.
export default function GalleryGrid({
  onOpenPods,
  onOpenLetsChat,
  weatherActive,
}: GalleryGridProps) {
  // One flag per grid slot — flips true once that slot's arrival animation
  // finishes (see ArrivalSlot's onAnimationEnd below), which is also what
  // switches the card from pointer-events-none/cursor-wait to clickable.
  const [docked, setDocked] = useState<boolean[]>(() => Array(9).fill(false));
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showMediaFlowGate, setShowMediaFlowGate] = useState(false);
  // Only ever polls anything for a signed-in admin — see the hook itself.
  const { isAdmin, approvals: pendingApprovals, refetch: refetchApprovals } = useKaliPendingApprovals();
  const dock = (i: number) => setDocked((prev) => (prev[i] ? prev : prev.map((v, idx) => (idx === i ? true : v))));

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Hero — max-w-5xl mx-auto matches the card grid below so both
          align at the same edges instead of the banner bleeding wider. */}
      <div className="flex flex-col items-center justify-center max-w-5xl gap-2 px-4 pb-10 mx-auto text-center pt-14">
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
        className="grid max-w-5xl grid-cols-1 gap-4 px-4 mx-auto pb-14 sm:grid-cols-2 lg:grid-cols-3"
        style={{ perspective: '1200px' }}
      >
        <ArrivalSlot index={0} docked={docked[0]} onDock={dock}>
          <Link href="/radio" className={cardClassRadio}>
            <RadioWaveformCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Radio Central</div>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={1} docked={docked[1]} onDock={dock}>
          <button onClick={onOpenPods} className={cardClass}>
            <StudioPreviewCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Studio One</div>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={2} docked={docked[2]} onDock={dock}>
          <Link href="/star" className={cardClass}>
            <StarTrackerCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Star Tracker PRO</div>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={3} docked={docked[3]} onDock={dock}>
          <button onClick={() => setShowWeatherOverlay(true)} className={cardClass}>
            <WeatherCardImage />
            <CardHeader active={weatherActive} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Weather</div>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={4} docked={docked[4]} onDock={dock}>
          <div className="relative w-full h-full">
            <Link href="/kali" className={cardClass}>
              <KaliQuantumEquationCardImage />
              <CardHeader />
              <div className="mt-4">
                <div className="text-sm font-bold text-white">Ai One</div>
              </div>
            </Link>
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
          {/* Re-enabled — was muted after the old hardware/flipbook build
              behind it turned out to be a dead end. /products now hosts a
              real product (the CesiumJS drone simulator), so this is a
              normal link again. BeatBrokerz/SoundClick is still promoted
              through social media rather than this card. */}
          <Link href="/products" className={cardClass}>
            <MatrixRainCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Drone Simulator</div>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={6} docked={docked[6]} onDock={dock}>
          {/* Was a reserved Merch slot (HydroNode Builder Kit's hardware
              listing never landed) — now a real product: Spectre-AI GCS,
              a beginner-friendly standalone flight simulator/trainer
              (failsafe drills, AI object detection, MAVLink-ready) at
              public/spectre-gcs.html via the /flight-school rewrite.
              Deliberately a separate product from the Drone Simulator card
              above, not a replacement — that one explores real-world
              Charleston; this one teaches flying itself. */}
          <Link href="/flight-school" className={cardClass}>
            <FlightSchoolCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Flight School</div>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={7} docked={docked[7]} onDock={dock}>
          <div className="relative w-full h-full">
            <button onClick={() => setShowMediaFlowGate(true)} className={cardClass}>
              <DigitalMagazineTickerCardImage />
              <CardHeader />
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                  Digital Magazine
                  <Lock className="w-3 h-3 text-slate-400" aria-label="Admin-only" />
                </div>
              </div>
            </button>
          </div>
        </ArrivalSlot>

        <ArrivalSlot index={8} docked={docked[8]} onDock={dock}>
          {/* Astro Simulator is a real route in this app (app/astro-sim), the
              same pattern as Flight School. */}
          <Link href="/astro-sim" className={cardClass}>
            <AstroSimCardImage />
            <CardHeader />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Astro Simulator</div>
            </div>
          </Link>
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
      {showMediaFlowGate && (
        <MediaFlowPasskeyGate
          onClose={() => setShowMediaFlowGate(false)}
          onSuccess={() => {
            setShowMediaFlowGate(false);
            onOpenLetsChat();
          }}
        />
      )}
    </div>
  );
}

// Client-side gate only — the passkey lives in this bundle's source, so it
// deters casual clicks rather than actually securing the route (anyone
// reading the JS can find "3045"). Good enough for the stated goal (a
// soft admin-only prompt on this one card); not a real auth boundary.
const MEDIA_FLOW_PASSKEY = '3045';

function MediaFlowPasskeyGate({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === MEDIA_FLOW_PASSKEY) {
      onSuccess();
    } else {
      setInvalid(true);
      setValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-xs p-5 border shadow-2xl rounded-2xl border-slate-800 bg-slate-950/95"
      >
        <div className="flex items-center gap-2 mb-3 text-sm font-bold text-white">
          <Lock className="w-4 h-4 text-slate-400" />
          Admin Access — Digital Magazine
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="Enter passkey"
          className={`w-full px-3 py-2 text-sm text-white bg-slate-900 border rounded-lg outline-none ${
            invalid ? 'border-red-500' : 'border-slate-700 focus:border-slate-500'
          }`}
        />
        {invalid && <p className="mt-1.5 text-xs text-red-400">Invalid Passkey</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-950 hover:bg-slate-200"
          >
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}
