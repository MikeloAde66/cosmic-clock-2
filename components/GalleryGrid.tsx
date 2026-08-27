'use client';

import React, { useState } from 'react';
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
// aioneCore/hydronodeBuilderKit point at real, already-approved hero
// images instead of an unfilled /gallery/ path — the same
// heroImageSrc files lib/hardwareProducts.ts already uses on those
// products' own detail pages (public/images/aione-core.png,
// public/images/hydronode-pro.png), confirmed to exist on disk. Reusing
// them here, rather than a placeholder gradient, is exactly what "only use
// approved high-res assets, never stock placeholders" calls for once a
// real asset is confirmed to exist for that exact module.
const GALLERY_IMAGES = {
  radio: '/gallery/radio.png',
  studio: '/gallery/studio.png',
  kali: '/gallery/kali.png',
  starTracker: '/gallery/star-tracker.png',
  aioneCore: '/images/aione-core.png',
  hydronodeBuilderKit: '/images/hydronode-pro.png',
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
  aioneCore: 'linear-gradient(135deg, #818cf8 0%, #4338ca 55%, #0f172a 100%)',
  hydronodeBuilderKit: 'linear-gradient(135deg, #5eead4 0%, #0f766e 55%, #042f2e 100%)',
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
const RADIO_WAVEFORM_BARS = Array.from({ length: 32 }, (_, i) => ({
  height: 22 + 70 * Math.abs(Math.sin(i * 0.85 + 1)),
  duration: 0.8 + (i % 5) * 0.18,
  // Negative delays start each bar mid-cycle rather than all 32 launching
  // from zero in lockstep on mount, so it reads as already-in-progress
  // playback instead of a synchronized twitch.
  delay: -((i % 7) * 0.19),
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

// Preview strip — a finished-looking gradient cover (see CARD_GRADIENTS)
// plus a faint star-dot texture and an oversized icon watermark render
// immediately, so every card shows a concrete, rich visual from the first
// paint. The real photo from public/gallery/ fades in on top the moment it
// loads; until then (or if it 404s) the gradient cover is the whole show,
// not a fallback that reads as "missing."
function CardImage({ src, gradient, Icon }: { src: string; gradient: string; Icon: typeof ArrowUpRight }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

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
// full players/chat into tiny tiles); Ai One Core/HydroNode Builder
// Kit/Products are real routes; Weather is a direct action (no standalone
// view at all — see lib/useWeatherLocation.ts — so its card just opens the
// same inline footer search the umbrella icon does, without leaving
// Gallery mode). Digital Magazine opens Let's Chat (TenForwardSection) —
// still the same honest, no-fabricated-content empty shell that component
// has always been; there's no forum/community backend to point it at yet.
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
            textShadow: '0 2px 24px rgba(0,0,0,0.6), 0 0 40px rgba(96,165,250,0.25)',
          }}
        >
          Ai One
        </h1>
        <p className="font-mono text-xs tracking-widest uppercase text-slate-400">Cosmic Creation &amp; Broadcast Hub</p>
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
            <CardImage src={GALLERY_IMAGES.studio} gradient={CARD_GRADIENTS.studio} Icon={Mic} />
            <CardHeader Icon={Mic} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Studio One</div>
              <p className="mt-1 text-xs text-slate-400">Your track library, uploads, and playlists.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={2} docked={docked[2]} onDock={dock}>
          <button onClick={onOpenStarTracker} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.starTracker} gradient={CARD_GRADIENTS.starTracker} Icon={Telescope} />
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
              <CardImage src={GALLERY_IMAGES.kali} gradient={CARD_GRADIENTS.kali} Icon={Sparkles} />
              <CardHeader Icon={Sparkles} />
              <div className="mt-4">
                <div className="text-sm font-bold text-white">Kali</div>
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
            <CardImage src={GALLERY_IMAGES.productsCatalog} gradient={CARD_GRADIENTS.productsCatalog} Icon={LayoutGrid} />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Products</div>
              <p className="mt-1 text-xs text-slate-400">Hardware and kits — browse the full catalog.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={6} docked={docked[6]} onDock={dock}>
          <Link href="/products/aione-core" className={cardClass}>
            <CardImage src={GALLERY_IMAGES.aioneCore} gradient={CARD_GRADIENTS.aioneCore} Icon={LayoutGrid} />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Ai One Core</div>
              <p className="mt-1 text-xs text-slate-400">The agentic engine — pure-software autonomous intelligence hub.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={7} docked={docked[7]} onDock={dock}>
          <Link href="/products/builder-kit" className={cardClass}>
            <CardImage src={GALLERY_IMAGES.hydronodeBuilderKit} gradient={CARD_GRADIENTS.hydronodeBuilderKit} Icon={LayoutGrid} />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">HydroNode Builder Kit</div>
              <p className="mt-1 text-xs text-slate-400">Digital OS &amp; blueprints for self-build water intelligence.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={8} docked={docked[8]} onDock={dock}>
          <button onClick={onOpenLetsChat} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.communityHub} gradient={CARD_GRADIENTS.communityHub} Icon={Newspaper} />
            <CardHeader Icon={Newspaper} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Digital Magazine</div>
              <p className="mt-1 text-xs text-slate-400">Community hub — stories, discussions, and Let&apos;s Chat.</p>
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
