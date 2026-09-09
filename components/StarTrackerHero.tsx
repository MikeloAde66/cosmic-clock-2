'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { localSiderealTime } from '@/lib/siderealTime';

interface DsnLinkSummary {
  dishName: string;
  stationName: string;
  spacecraftName: string;
}

export default function StarTrackerHero() {
  // Greenwich Apparent Sidereal Time, ticking every real second — this page
  // has no user-location context of its own (unlike the live app), so it's
  // labeled GAST rather than "LST" to stay accurate about what it actually
  // is: longitude=0, not a fabricated "your local" reading.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Real live NASA/JPL DSN Now data (see app/api/dsn/telemetry) — not a
  // hardcoded "DSS25 GOLDSTONE [ACTIVE]" placeholder. null while loading or
  // if the feed genuinely has no active link right now, shown as such
  // rather than a fake permanent "ACTIVE" status.
  const [dsnLink, setDsnLink] = useState<DsnLinkSummary | null>(null);
  const [dsnLoaded, setDsnLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dsn/telemetry')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { links?: DsnLinkSummary[] } | null) => {
        if (cancelled) return;
        setDsnLink(data?.links?.[0] ?? null);
        setDsnLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setDsnLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 overflow-hidden font-sans">
      {/* Ambient Starlight Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Telemetry Bar — both readouts are real and live, not decorative placeholders */}
      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-cyan-500/20 pb-4 gap-2 font-mono text-xs text-cyan-400/80 tracking-widest">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dsnLink ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
          <span>
            {dsnLink
              ? `DSN LINK: ${dsnLink.dishName} ${dsnLink.stationName.toUpperCase()} — ${dsnLink.spacecraftName} [ACTIVE]`
              : dsnLoaded
                ? 'DSN: NO ACTIVE LINK RIGHT NOW'
                : 'DSN: CONNECTING…'}
          </span>
        </div>
        <div>GAST: {now ? localSiderealTime(now, 0) : '--:--:--'}</div>
      </div>

      {/* Main Cinematic Hero Copy */}
      <div className="relative z-10 my-auto max-w-4xl space-y-6 pt-12">
        <div className="inline-block px-3 py-1 bg-cyan-950/60 border border-cyan-500/30 rounded-full text-cyan-300 font-mono text-xs tracking-wider">
          STANDALONE OBSERVATORY SUITE
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white leading-none">
          COMMAND THE <br />
          <span className="bg-gradient-to-r from-cyan-400 via-teal-200 to-indigo-400 bg-clip-text text-transparent">
            NIGHT SKY.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl font-light leading-relaxed">
          Step into the control room. Real-time deep space telemetry, orbital mechanics, and precision scope control mapped directly to your local horizon.
        </p>

        {/* Action Triggers — both open the real live app at /star-tracker */}
        <div className="flex flex-wrap gap-4 pt-4 font-mono text-sm">
          <Link
            href="/star-tracker"
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded border border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.3)] transition-all"
          >
            [ INITIALIZE OBSERVATORY FEED ]
          </Link>
          <Link
            href="/star-tracker"
            className="px-8 py-4 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 rounded border border-cyan-500/30 backdrop-blur-md transition-all"
          >
            [ VIEW LIVE DSN TELEMETRY ]
          </Link>
        </div>
      </div>

      {/* Bottom Instrumentation HUD Card */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/80 pt-6 font-mono text-xs text-slate-400">
        <div className="bg-slate-900/40 p-4 rounded border border-slate-800/60 backdrop-blur-sm">
          <span className="text-cyan-400 block mb-1">01 / DSN DOWNLINK</span>
          Live signal band, data rate, and one-way light-time from NASA&apos;s real Deep Space Network.
        </div>
        <div className="bg-slate-900/40 p-4 rounded border border-slate-800/60 backdrop-blur-sm">
          <span className="text-cyan-400 block mb-1">02 / LX200 &amp; NEXSTAR</span>
          Real mount control over Web Serial or Bluetooth — live position polling, goto/slew, and tracking rate.
        </div>
        <div className="bg-slate-900/40 p-4 rounded border border-slate-800/60 backdrop-blur-sm">
          <span className="text-cyan-400 block mb-1">03 / SPECTRAL OVERLAYS</span>
          Multi-wavelength mapping across optical, infrared, radio, and X-ray bands.
        </div>
      </div>
    </section>
  );
}
