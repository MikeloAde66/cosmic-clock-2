'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Body as AstroBody, Equator, Horizon, Illumination, Observer, SearchRiseSet } from 'astronomy-engine';

const TRACKED_BODIES: AstroBody[] = [
  AstroBody.Sun,
  AstroBody.Moon,
  AstroBody.Mercury,
  AstroBody.Venus,
  AstroBody.Mars,
  AstroBody.Jupiter,
  AstroBody.Saturn,
];

interface SkyBody {
  name: string;
  azimuth: number;
  altitude: number;
  magnitude: number | null;
  nextRise: Date | null;
  nextSet: Date | null;
}

function compassDirection(azimuth: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(azimuth / 45) % 8];
}

function computeSky(observer: Observer, now: Date): SkyBody[] {
  return TRACKED_BODIES.map((body) => {
    const eq = Equator(body, now, observer, true, true);
    const hor = Horizon(now, observer, eq.ra, eq.dec, 'normal');
    // Magnitude isn't a meaningful "how bright" cue for the Sun/Moon the way
    // it is for planets (both are always far brighter than the scale really
    // describes), so it's only shown for the five planets.
    const magnitude = body === AstroBody.Sun || body === AstroBody.Moon ? null : Illumination(body, now).mag;
    const nextRise = SearchRiseSet(body, observer, 1, now, 1);
    const nextSet = SearchRiseSet(body, observer, -1, now, 1);
    return {
      name: body,
      azimuth: hor.azimuth,
      altitude: hor.altitude,
      magnitude,
      nextRise: nextRise ? nextRise.date : null,
      nextSet: nextSet ? nextSet.date : null,
    };
  }).sort((a, b) => b.altitude - a.altitude);
}

// Polar sky-dome: zenith (altitude 90°) at the center, horizon (altitude 0°)
// at the rim, azimuth as the angle around the circle with north at top —
// the standard way stargazing charts lay out "what's overhead right now."
function SkyDome({ bodies }: { bodies: SkyBody[] }) {
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 24;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      <circle cx={center} cy={center} r={radius} fill="rgba(6,20,28,0.6)" stroke="rgba(34,211,238,0.3)" strokeWidth={1} />
      <circle cx={center} cy={center} r={radius * 0.5} fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth={1} />
      {['N', 'E', 'S', 'W'].map((label, i) => {
        const angle = (i * 90 - 90) * (Math.PI / 180);
        const x = center + (radius + 12) * Math.cos(angle);
        const y = center + (radius + 12) * Math.sin(angle);
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-cyan-500/70" fontSize={10} fontFamily="monospace">
            {label}
          </text>
        );
      })}
      {bodies
        .filter((b) => b.altitude > 0)
        .map((b) => {
          // North at top (azimuth 0 → -90° in SVG angle space), clockwise.
          const angle = (b.azimuth - 90) * (Math.PI / 180);
          const r = radius * (1 - b.altitude / 90);
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);
          const isLuminary = b.name === 'Sun' || b.name === 'Moon';
          return (
            <g key={b.name}>
              <circle cx={x} cy={y} r={isLuminary ? 5 : 3.5} fill={isLuminary ? '#67e8f9' : '#e2e8f0'} />
              <text x={x} y={y - 9} textAnchor="middle" className="fill-slate-300" fontSize={9} fontFamily="monospace">
                {b.name}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

type LocationStatus = 'requesting' | 'granted' | 'denied' | 'unavailable';

export default function StarTrackerView({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<LocationStatus>('requesting');
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setStatus('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus('granted');
      },
      () => setStatus('denied'),
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const observer = useMemo(() => new Observer(coords.lat, coords.lon, 0), [coords]);
  const sky = useMemo(() => computeSky(observer, now), [observer, now]);
  const visible = sky.filter((b) => b.altitude > 0);
  const belowHorizon = sky.filter((b) => b.altitude <= 0);

  const locationLabel =
    status === 'granted'
      ? `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`
      : status === 'requesting'
        ? 'Locating…'
        : 'Location unavailable — showing sky at 0°N, 0°E';

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/80">Sky Above You</span>
          <h2 className="text-2xl font-bold tracking-wider text-white">Star Tracker</h2>
          <p className="mt-1 font-mono text-xs text-cyan-100/80">
            {locationLabel} · {now.toLocaleTimeString()}
          </p>
        </div>

        <div className="p-4 border rounded-lg border-cyan-500/20 bg-black/30">
          <SkyDome bodies={sky} />
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/70">
            Visible now ({visible.length})
          </h3>
          {visible.length === 0 && <p className="text-xs text-slate-500">Nothing tracked is above the horizon right now.</p>}
          {visible.map((b) => (
            <div key={b.name} className="flex items-center justify-between px-3 py-2 border rounded border-slate-800 bg-slate-900/40">
              <div>
                <span className="text-sm font-bold text-white">{b.name}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-400">
                  {compassDirection(b.azimuth)} · alt {b.altitude.toFixed(0)}°
                  {b.magnitude !== null && ` · mag ${b.magnitude.toFixed(1)}`}
                </span>
              </div>
              {b.nextSet && (
                <span className="font-mono text-[10px] text-slate-500">sets {b.nextSet.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          ))}
        </div>

        {belowHorizon.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Below the horizon</h3>
            {belowHorizon.map((b) => (
              <div key={b.name} className="flex items-center justify-between px-3 py-2 border rounded border-slate-900 bg-slate-950/40">
                <span className="text-sm text-slate-500">{b.name}</span>
                {b.nextRise && (
                  <span className="font-mono text-[10px] text-slate-600">
                    rises {b.nextRise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
