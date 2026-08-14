'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Satellite, Sun as SunIcon, X } from 'lucide-react';
import { Body as AstroBody, Equator, Horizon, Illumination, Observer, SearchRiseSet, SiderealTime } from 'astronomy-engine';
import { calculateCosmicTime } from '@/lib/cosmicMath';
import { fetchIssPosition, topocentricPosition, type IssStatus } from '@/lib/satelliteTracking';
import { describeKp, fetchLatestKp, type KpReading } from '@/lib/spaceWeather';

// Same deterministic PRNG + twinkle approach as CosmicCanvas's own
// starfield, kept local here rather than shared — it's an 8-line pure
// function, and this view has no other dependency on that component.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 110;
const randomStar = mulberry32(20260814);
const BACKGROUND_STARS = Array.from({ length: STAR_COUNT }, () => {
  const twinkles = randomStar() < 0.2;
  return {
    top: `${(randomStar() * 100).toFixed(2)}%`,
    left: `${(randomStar() * 100).toFixed(2)}%`,
    size: `${(1 + randomStar() * 1.5).toFixed(2)}px`,
    opacity: 0.15 + randomStar() * 0.7,
    twinkles,
    delay: `${(randomStar() * 4).toFixed(2)}s`,
    duration: `${(2.5 + randomStar() * 2.5).toFixed(2)}s`,
  };
});

const TRACKED_BODIES: AstroBody[] = [
  AstroBody.Sun,
  AstroBody.Moon,
  AstroBody.Mercury,
  AstroBody.Venus,
  AstroBody.Mars,
  AstroBody.Jupiter,
  AstroBody.Saturn,
];

const AU_IN_KM = 149_597_870;

interface SkyBody {
  name: string;
  azimuth: number;
  altitude: number;
  magnitude: number | null;
  distanceAu: number;
  nextRise: Date | null;
  nextSet: Date | null;
}

function compassDirection(azimuth: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(azimuth / 45) % 8];
}

function formatDistance(au: number): string {
  return au < 0.01 ? `${Math.round(au * AU_IN_KM).toLocaleString()} km` : `${au.toFixed(3)} AU`;
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
      distanceAu: eq.dist,
      nextRise: nextRise ? nextRise.date : null,
      nextSet: nextSet ? nextSet.date : null,
    };
  }).sort((a, b) => b.altitude - a.altitude);
}

// Local Sidereal Time = Greenwich Apparent Sidereal Time (astronomy-engine's
// SiderealTime, in sidereal hours) shifted by the observer's longitude —
// each 15° of longitude is 1 sidereal hour.
function localSiderealTime(now: Date, longitude: number): string {
  const gast = SiderealTime(now);
  const lst = (((gast + longitude / 15) % 24) + 24) % 24;
  const hours = Math.floor(lst);
  const minutes = Math.floor((lst - hours) * 60);
  const seconds = Math.floor((((lst - hours) * 60 - minutes) * 60));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function azAltToXY(azimuth: number, altitude: number, center: number, radius: number) {
  // North at top (azimuth 0 -> -90° in SVG angle space), clockwise; zenith
  // (altitude 90°) at the center, horizon (altitude 0°) at the rim.
  const angle = (azimuth - 90) * (Math.PI / 180);
  const r = radius * (1 - Math.max(altitude, 0) / 90);
  return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
}

type LocationStatus = 'requesting' | 'granted' | 'denied' | 'unavailable';
type SelectedItem = { kind: 'body'; body: SkyBody } | { kind: 'iss' } | null;

export default function StarTrackerView({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<LocationStatus>('requesting');
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedItem>(null);

  // Pan/zoom state for the sky dome — drag to pan, wheel to zoom.
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const domeRef = useRef<SVGSVGElement | null>(null);

  const [issLayerOn, setIssLayerOn] = useState(false);
  const [iss, setIss] = useState<IssStatus | null>(null);
  const [issError, setIssError] = useState(false);

  const [spaceWeatherOn, setSpaceWeatherOn] = useState(false);
  const [kp, setKp] = useState<KpReading | null>(null);
  const [kpError, setKpError] = useState(false);

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

  // ISS position polling — only while the layer is toggled on, so this app
  // isn't hitting a third-party API in the background for a feature no one
  // has opened.
  useEffect(() => {
    if (!issLayerOn) return;
    let cancelled = false;
    const poll = () => {
      fetchIssPosition()
        .then((data) => {
          if (!cancelled) {
            setIss(data);
            setIssError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setIssError(true);
        });
    };
    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [issLayerOn]);

  useEffect(() => {
    if (!spaceWeatherOn) return;
    let cancelled = false;
    fetchLatestKp()
      .then((data) => {
        if (!cancelled) {
          setKp(data);
          setKpError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setKpError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceWeatherOn]);

  const observer = useMemo(() => new Observer(coords.lat, coords.lon, 0), [coords]);
  const sky = useMemo(() => computeSky(observer, now), [observer, now]);
  const visible = sky.filter((b) => b.altitude > 0);
  const belowHorizon = sky.filter((b) => b.altitude <= 0);

  const issTopo = useMemo(() => {
    if (!iss) return null;
    return topocentricPosition({ latitude: coords.lat, longitude: coords.lon, altitude: 0 }, iss.geo);
  }, [iss, coords]);

  const cosmic = calculateCosmicTime();
  const locationLabel =
    status === 'granted'
      ? `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`
      : status === 'requesting'
        ? 'Locating…'
        : 'Location unavailable — showing sky at 0°N, 0°E';

  // Dome geometry + pan/zoom handlers
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 24;

  // React attaches wheel listeners as passive by default (for scroll
  // performance), which silently no-ops preventDefault on a JSX onWheel —
  // the page would scroll behind the dome while zooming it. A native
  // listener with passive:false is the only way to actually stop that.
  useEffect(() => {
    const el = domeRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, scale: Math.min(3, Math.max(1, v.scale - e.deltaY * 0.001)) }));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: e.clientX - view.tx, y: e.clientY - view.ty };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    setView((v) => ({ ...v, tx: e.clientX - dragRef.current!.x, ty: e.clientY - dragRef.current!.y }));
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
      {/* Ambient starfield backdrop — fixed to the viewport, not the scroll
          container, so it stays put while the content above scrolls over it */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {BACKGROUND_STARS.map((star, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full bg-white shadow-[0_0_4px_#ffffff] ${star.twinkles ? 'animate-star-twinkle' : ''}`}
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.twinkles ? undefined : star.opacity,
              animationDelay: star.twinkles ? star.delay : undefined,
              animationDuration: star.twinkles ? star.duration : undefined,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-2 mb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto space-y-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/80">Sky Above You</span>
          <h2 className="text-2xl font-bold tracking-wider text-white">Star Tracker</h2>
          <p className="mt-1 font-mono text-xs text-cyan-100/80">{locationLabel}</p>
        </div>

        {/* Time Sync header */}
        <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg border-cyan-500/20 bg-black/30">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Local Time</div>
            <div className="font-mono text-sm text-white">{now.toLocaleTimeString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Sidereal Time</div>
            <div className="font-mono text-sm text-cyan-300">{localSiderealTime(now, coords.lon)}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Kali Yuga Epoch</div>
            <div className="font-mono text-sm text-white">{cosmic.kaliYugaProgressPercent}%</div>
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIssLayerOn((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded-full border transition ${
              issLayerOn ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <Satellite className="w-3 h-3" />
            ISS
          </button>
          <button
            type="button"
            onClick={() => setSpaceWeatherOn((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded-full border transition ${
              spaceWeatherOn ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <SunIcon className="w-3 h-3" />
            Space Weather
          </button>
          <button
            type="button"
            onClick={resetView}
            className="px-3 py-1 text-[10px] font-mono uppercase tracking-wide border rounded-full border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
          >
            Reset view
          </button>
        </div>

        {spaceWeatherOn && (
          <div className="px-3 py-2 border rounded-lg border-cyan-500/20 bg-black/30">
            {kpError ? (
              <p className="font-mono text-xs text-red-400">Space weather data unavailable right now.</p>
            ) : kp ? (
              <p className="font-mono text-xs text-cyan-100">
                Planetary K-index: <span className="font-bold text-white">{kp.kp.toFixed(2)}</span> — {describeKp(kp.kp)}
              </p>
            ) : (
              <p className="font-mono text-xs text-slate-500">Loading space weather…</p>
            )}
          </div>
        )}

        {issLayerOn && (
          <div className="px-3 py-2 border rounded-lg border-cyan-500/20 bg-black/30">
            {issError ? (
              <p className="font-mono text-xs text-red-400">ISS position unavailable right now.</p>
            ) : iss && issTopo ? (
              <p className="font-mono text-xs text-cyan-100">
                ISS is {issTopo.altitude > 0 ? 'above your horizon' : 'below your horizon'} — {compassDirection(issTopo.azimuth)}
                {issTopo.altitude > 0 ? `, alt ${issTopo.altitude.toFixed(0)}°` : ''} · {iss.visibility}
              </p>
            ) : (
              <p className="font-mono text-xs text-slate-500">Locating ISS…</p>
            )}
          </div>
        )}

        <div className="p-4 border rounded-lg border-cyan-500/20 bg-black/30">
          <svg
            ref={domeRef}
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[280px] mx-auto touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} style={{ transformOrigin: `${center}px ${center}px` }}>
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
              {visible.map((b) => {
                const { x, y } = azAltToXY(b.azimuth, b.altitude, center, radius);
                const isLuminary = b.name === 'Sun' || b.name === 'Moon';
                return (
                  <g key={b.name} onClick={() => setSelected({ kind: 'body', body: b })} className="cursor-pointer">
                    <circle cx={x} cy={y} r={isLuminary ? 6 : 4.5} fill={isLuminary ? '#67e8f9' : '#e2e8f0'} stroke="transparent" strokeWidth={8} />
                    <text x={x} y={y - 9} textAnchor="middle" className="pointer-events-none fill-slate-300" fontSize={9} fontFamily="monospace">
                      {b.name}
                    </text>
                  </g>
                );
              })}
              {issLayerOn && issTopo && issTopo.altitude > 0 && (
                <g onClick={() => setSelected({ kind: 'iss' })} className="cursor-pointer">
                  {(() => {
                    const { x, y } = azAltToXY(issTopo.azimuth, issTopo.altitude, center, radius);
                    return (
                      <>
                        <rect x={x - 4} y={y - 4} width={8} height={8} fill="#22d3ee" stroke="transparent" strokeWidth={8} />
                        <text x={x} y={y - 10} textAnchor="middle" className="pointer-events-none fill-cyan-300" fontSize={9} fontFamily="monospace">
                          ISS
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* Detail panel for the selected body/satellite — inline, not a modal */}
        {selected && (
          <div className="relative p-4 border rounded-lg border-cyan-500/40 bg-cyan-950/20">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute flex items-center justify-center w-6 h-6 rounded top-2 right-2 text-slate-400 hover:text-white hover:bg-black/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {selected.kind === 'body' ? (
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">{selected.body.name}</h3>
                <p className="font-mono text-xs text-cyan-100">
                  {compassDirection(selected.body.azimuth)} ({selected.body.azimuth.toFixed(1)}°) · altitude {selected.body.altitude.toFixed(1)}°
                </p>
                {selected.body.magnitude !== null && (
                  <p className="font-mono text-xs text-cyan-100">Magnitude {selected.body.magnitude.toFixed(2)}</p>
                )}
                <p className="font-mono text-xs text-cyan-100">Distance {formatDistance(selected.body.distanceAu)}</p>
                {selected.body.nextRise && (
                  <p className="font-mono text-xs text-slate-400">Next rise {selected.body.nextRise.toLocaleTimeString()}</p>
                )}
                {selected.body.nextSet && (
                  <p className="font-mono text-xs text-slate-400">Next set {selected.body.nextSet.toLocaleTimeString()}</p>
                )}
              </div>
            ) : (
              iss &&
              issTopo && (
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">International Space Station</h3>
                  <p className="font-mono text-xs text-cyan-100">
                    {compassDirection(issTopo.azimuth)} ({issTopo.azimuth.toFixed(1)}°) · altitude {issTopo.altitude.toFixed(1)}°
                  </p>
                  <p className="font-mono text-xs text-cyan-100">Range {Math.round(issTopo.rangeKm).toLocaleString()} km</p>
                  <p className="font-mono text-xs text-cyan-100">Orbital altitude {Math.round(iss.geo.altitude)} km</p>
                  <p className="font-mono text-xs text-slate-400">Status: {iss.visibility}</p>
                </div>
              )
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/70">
            Visible now ({visible.length})
          </h3>
          {visible.length === 0 && <p className="text-xs text-slate-500">Nothing tracked is above the horizon right now.</p>}
          {visible.map((b) => (
            <button
              type="button"
              key={b.name}
              onClick={() => setSelected({ kind: 'body', body: b })}
              className="flex items-center justify-between w-full px-3 py-2 text-left transition border rounded border-slate-800 bg-slate-900/40 hover:border-cyan-500/40"
            >
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
            </button>
          ))}
        </div>

        {belowHorizon.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Below the horizon</h3>
            {belowHorizon.map((b) => (
              <button
                type="button"
                key={b.name}
                onClick={() => setSelected({ kind: 'body', body: b })}
                className="flex items-center justify-between w-full px-3 py-2 text-left transition border rounded border-slate-900 bg-slate-950/40 hover:border-slate-700"
              >
                <span className="text-sm text-slate-500">{b.name}</span>
                {b.nextRise && (
                  <span className="font-mono text-[10px] text-slate-600">
                    rises {b.nextRise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.85; transform: scale(1.2); }
        }
        .animate-star-twinkle {
          animation-name: star-twinkle;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
