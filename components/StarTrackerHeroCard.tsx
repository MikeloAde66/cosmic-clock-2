'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Starfield from './Starfield';

// Real specs, not marketing copy — DSN Telemetry and Deep Sky Spectrum are
// the two actual Sky Fest tabs in StarTrackerView.tsx (see app/api/dsn/
// telemetry and lib/skyviewSurveys.ts), so this cycles through what the
// product genuinely does rather than an invented feature list.
const TYPEWRITER_PHRASES = [
  'DSN Telemetry: Deep Space Network & Satellite Downlinks — Live signal strength (dBm), data rates, and light-time communication delays (e.g., 22+ hours for Voyager 1).',
  'Deep Sky Spectrum: AI Dynamic Galactic Mapping — Multi-frequency overlays including Infrared (JWST), Radio (21cm Hydrogen line), and X-Ray (Chandra). Selecting targets prompts Kali AI spectral breakdowns.',
];

const TYPE_MS = 24;
const DELETE_MS = 12;
const HOLD_MS = 3200;
const PAUSE_MS = 450;

// Hand-rolled rather than a dependency — cycles through `phrases`
// indefinitely: type forward, hold, delete backward, brief pause, repeat
// with the next phrase.
function useTypewriter(phrases: string[]) {
  const [displayed, setDisplayed] = useState('');
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length];
    let delay = deleting ? DELETE_MS : TYPE_MS;
    if (!deleting && displayed === current) delay = HOLD_MS;
    else if (deleting && displayed === '') delay = PAUSE_MS;

    const timeout = setTimeout(() => {
      if (!deleting) {
        if (displayed.length < current.length) {
          setDisplayed(current.slice(0, displayed.length + 1));
        } else {
          setDeleting(true);
        }
      } else if (displayed.length > 0) {
        setDisplayed(displayed.slice(0, -1));
      } else {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [displayed, deleting, index, phrases]);

  return displayed;
}

export default function StarTrackerHeroCard() {
  const typed = useTypewriter(TYPEWRITER_PHRASES);

  return (
    <div className="flex items-center justify-center w-full h-full p-6">
      <Link
        href="/products/star-tracker"
        aria-label="Explore Star Tracker PRO specs"
        className="relative block w-full max-w-md h-[480px] overflow-hidden transition border rounded-xl border-cyan-500/30 bg-slate-900/40 backdrop-blur-md hover:border-cyan-400/60 group"
      >
        {/* Ambient drifting starfield — the same real, deterministic
            component used app-wide (contained mode: absolute + transparent,
            designed exactly for mounting inside another element like this
            card), not a bespoke particle system. */}
        <Starfield contained starCount={160} />

        <div className="relative z-10 flex flex-col h-full p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">Standalone</p>
          <h3 className="mt-1 text-3xl font-bold text-white">Star Tracker PRO</h3>
          <p className="mt-1 text-sm text-slate-400">See Beyond the Horizon.</p>

          <div className="flex items-center flex-1 mt-6">
            <p className="font-mono text-sm leading-relaxed text-cyan-100/90 min-h-[6rem]">
              {typed}
              <span className="inline-block w-[2px] h-[1em] ml-0.5 -mb-[2px] bg-cyan-300 animate-pulse" />
            </p>
          </div>

          <span className="self-start px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border rounded border-cyan-500/40 text-cyan-300 group-hover:border-cyan-400 group-hover:text-cyan-200 transition">
            Explore Specs →
          </span>
        </div>
      </Link>
    </div>
  );
}
