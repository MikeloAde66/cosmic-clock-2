'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Radio as RadioIcon, Mic, LayoutGrid, Umbrella, Sparkles, Gift, Telescope, Satellite, ArrowUpRight } from 'lucide-react';
import { useDonation } from '@/lib/useDonation';

interface GalleryGridProps {
  onOpenRadio: () => void;
  onOpenPods: () => void;
  onOpenKali: () => void;
  onOpenStarTracker: () => void;
  onOpenIss: () => void;
  onWeatherClick: () => void;
  weatherActive?: boolean;
}

// Canonical asset paths — real filenames per the explicit mapping given for
// the actual gallery source images. Drop each file into public/gallery/
// under its target name and the matching card picks it up automatically,
// no further code changes needed. Weather/Donate have no source image in
// the mapping, so they render icon-only (CardImage is simply omitted for
// those two below).
const GALLERY_IMAGES = {
  radio: '/gallery/radio.png',
  studio: '/gallery/studio.png',
  kali: '/gallery/kali.png',
  starTracker: '/gallery/star-tracker.png',
  aioneCore: '/gallery/products.png',
  hydronodeBuilderKit: '/gallery/hydronode.png',
  iss: '/gallery/iss.png',
} as const;

// Stagger offset between each card's arrival — 180ms sits in the
// requested 150-200ms window.
const ARRIVAL_STAGGER_MS = 180;

const cardClass =
  'group relative flex flex-col justify-between w-full h-full p-5 text-left border rounded-2xl border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-slate-600 hover:bg-slate-900/60 transition-all min-h-[140px] overflow-hidden';

// Photographic preview strip — a glassmorphic frame is always present
// underneath, so a slow or missing asset never leaves a bare gap; the real
// photo simply fades in on top of it once it loads, and the frame is all
// that's left to see if the file 404s.
function CardImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative w-full h-24 mb-3 -mx-5 -mt-5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-slate-800/40 to-slate-950/60 backdrop-blur-md" />
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`relative object-cover w-full h-full transition-opacity duration-500 ${
            loaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
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
    <div className="relative min-h-[140px]">
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
// Tracker/ISS land you in the dedicated Classic Hub view/overlay for that
// section (this is a launcher, not a place to cram full players/chat into
// tiny tiles); Ai One Core/HydroNode Builder Kit are real product routes;
// Weather and Donate are direct actions (Weather has no standalone view at
// all — see lib/useWeatherLocation.ts — so its card just opens the same
// inline footer search the umbrella icon does, without leaving Gallery
// mode).
export default function GalleryGrid({
  onOpenRadio,
  onOpenPods,
  onOpenKali,
  onOpenStarTracker,
  onOpenIss,
  onWeatherClick,
  weatherActive,
}: GalleryGridProps) {
  const { loading: donateLoading, error: donateError, donate } = useDonation();

  // One flag per grid slot — flips true once that slot's arrival animation
  // finishes (see ArrivalSlot's onAnimationEnd below), which is also what
  // switches the card from pointer-events-none/cursor-wait to clickable.
  const [docked, setDocked] = useState<boolean[]>(() => Array(9).fill(false));
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
          <button onClick={onOpenRadio} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.radio} />
            <CardHeader Icon={RadioIcon} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Radio Central</div>
              <p className="mt-1 text-xs text-slate-400">Live streaming stations, curated ambient/cosmic channels.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={1} docked={docked[1]} onDock={dock}>
          <button onClick={onOpenPods} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.studio} />
            <CardHeader Icon={Mic} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Studio One</div>
              <p className="mt-1 text-xs text-slate-400">Your track library, uploads, and playlists.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={2} docked={docked[2]} onDock={dock}>
          <button onClick={onOpenStarTracker} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.starTracker} />
            <CardHeader Icon={Telescope} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Star Tracker</div>
              <p className="mt-1 text-xs text-slate-400">Live orbital tracking and pass predictions.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={3} docked={docked[3]} onDock={dock}>
          <button onClick={onWeatherClick} className={cardClass}>
            <CardHeader Icon={Umbrella} active={weatherActive} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Weather</div>
              <p className="mt-1 text-xs text-slate-400">
                {weatherActive ? 'Forecast active — see the footer.' : 'Search a ZIP or city for a live forecast.'}
              </p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={4} docked={docked[4]} onDock={dock}>
          <button onClick={onOpenKali} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.kali} />
            <CardHeader Icon={Sparkles} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Kali</div>
              <p className="mt-1 text-xs text-slate-400">Ancient technology, quantum physics, epoch cycles.</p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={5} docked={docked[5]} onDock={dock}>
          <button onClick={donate} disabled={donateLoading} className={`${cardClass} disabled:opacity-60`}>
            <CardHeader Icon={Gift} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Donate</div>
              <p className="mt-1 text-xs text-slate-400">
                {donateError || (donateLoading ? 'Opening checkout…' : 'Support the project — $5 test donation.')}
              </p>
            </div>
          </button>
        </ArrivalSlot>

        <ArrivalSlot index={6} docked={docked[6]} onDock={dock}>
          <Link href="/products/aione-core" className={cardClass}>
            <CardImage src={GALLERY_IMAGES.aioneCore} />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">Ai One Core</div>
              <p className="mt-1 text-xs text-slate-400">The agentic engine — pure-software autonomous intelligence hub.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={7} docked={docked[7]} onDock={dock}>
          <Link href="/products/builder-kit" className={cardClass}>
            <CardImage src={GALLERY_IMAGES.hydronodeBuilderKit} />
            <CardHeader Icon={LayoutGrid} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">HydroNode Builder Kit</div>
              <p className="mt-1 text-xs text-slate-400">Digital OS &amp; blueprints for self-build water intelligence.</p>
            </div>
          </Link>
        </ArrivalSlot>

        <ArrivalSlot index={8} docked={docked[8]} onDock={dock}>
          <button onClick={onOpenIss} className={cardClass}>
            <CardImage src={GALLERY_IMAGES.iss} />
            <CardHeader Icon={Satellite} />
            <div className="mt-4">
              <div className="text-sm font-bold text-white">ISS Stream</div>
              <p className="mt-1 text-xs text-slate-400">Live HD feed from the International Space Station.</p>
            </div>
          </button>
        </ArrivalSlot>
      </div>
    </div>
  );
}
