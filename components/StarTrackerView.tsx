'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarClock, Satellite, Sparkles, Sun as SunIcon, X } from 'lucide-react';
import { Body as AstroBody, Equator, Horizon, Illumination, Observer, SearchRiseSet, SiderealTime } from 'astronomy-engine';
import { calculateCosmicTime } from '@/lib/cosmicMath';
import { fetchIssPosition, topocentricPosition, type IssStatus } from '@/lib/satelliteTracking';
import { describeKp, fetchLatestKp, type KpReading } from '@/lib/spaceWeather';
import {
  lonToRaHours,
  loadConstellationLines,
  loadConstellationNames,
  loadStars,
  type ConstellationLine,
  type ConstellationNames,
  type StarTuple,
} from '@/lib/skyChart';
import { daysUntil, getUpcomingEclipses, getUpcomingMeteorShowers, type UpcomingEclipse, type UpcomingMeteorShower } from '@/lib/skyEvents';
import { listPlaylist, parseYouTubeId, removePlaylistItem, savePlaylistItem, type PlaylistItem } from '@/lib/spaceMediaPlaylist';
import type { YouTubePlayer } from '@/lib/youtubeIframeApi';
import { MESSIER_OBJECTS } from '@/lib/messierCatalog';
import ObservatoryPicker, { OBSERVATORIES, type Observatory } from './ObservatoryPicker';
import { useTelescopeConnection } from '@/lib/useTelescopeConnection';
import TelescopeConnectPanel from './telescope/TelescopeConnectPanel';

// The same real NASA ISS live feed already used by ISSFeedModal (the
// header's "LIVE ISS" button) — reused here so the video is inline inside
// Star Tracker's ISS layer instead of a separate popup elsewhere in the app.
const ISS_STREAM_URL = 'https://www.youtube.com/embed/awQzjn72bI0?autoplay=1&mute=1';

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

// 'ip-fallback' is distinct from 'granted' — city-level IP geolocation is
// far less precise than real GPS, and the UI says so rather than silently
// presenting it as an exact position.
type LocationStatus = 'requesting' | 'granted' | 'ip-fallback' | 'denied' | 'unavailable';
type SelectedItem = { kind: 'body'; body: SkyBody } | { kind: 'iss' } | { kind: 'constellation'; id: string } | null;

// Fixed background stars/constellations have real RA/Dec already (unlike
// the tracked solar-system bodies, which need Equator() first to derive
// their current position) — this goes straight to Horizon().
function equatorialToXY(raHours: number, decDeg: number, observer: Observer, now: Date, center: number, radius: number) {
  const hor = Horizon(now, observer, raHours, decDeg, 'normal');
  if (hor.altitude <= 0) return null;
  return azAltToXY(hor.azimuth, hor.altitude, center, radius);
}

// Splits a constellation line strip into contiguous above-horizon runs —
// a strip that dips below the horizon partway through would otherwise draw
// a nonsensical line straight across the dome connecting its last visible
// point to its next one.
function projectLineStrip(points: number[][], observer: Observer, now: Date, center: number, radius: number): { x: number; y: number }[][] {
  const runs: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const [lon, lat] of points) {
    const xy = equatorialToXY(lonToRaHours(lon), lat, observer, now, center, radius);
    if (xy) {
      current.push(xy);
    } else if (current.length > 1) {
      runs.push(current);
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

// Individual focus modes replacing the old blanket on/off toggle.
// BRIGHT_STARS and MESSIER render points from their own catalogs instead
// of constellation lines — neither has a constellation-line filter.
type SkyFocusMode = 'OFF' | 'BIG_DIPPER' | 'ZODIAC' | 'BRIGHT_STARS' | 'MESSIER' | 'ALL';

// ConstellationLine only carries a real IAU 3-letter abbreviation (id) and
// raw line-strip coordinates — there's no groupId/target/isEcliptic field
// in the actual dataset (lib/skyChart.ts), so these modes are built
// against the one real, identifying field that exists.
//
// The trimmed star/constellation data has no separate "Big Dipper" line
// set — the Dipper is just 7 of Ursa Major's stars, not a distinct IAU
// figure — so this mode shows the whole Ursa Major (+ Ursa Minor, for
// Polaris at its tip) constellation lines, the closest honest match the
// real data supports.
const BIG_DIPPER_IDS = new Set(['UMa', 'UMi']);

// The 12 real IAU zodiac constellations (their standard 3-letter
// abbreviations), not a fabricated field.
const ZODIAC_IDS = new Set(['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc']);

function shouldDrawConstellation(id: string, mode: SkyFocusMode): boolean {
  if (mode === 'ALL') return true;
  if (mode === 'BIG_DIPPER') return BIG_DIPPER_IDS.has(id);
  if (mode === 'ZODIAC') return ZODIAC_IDS.has(id);
  return false; // OFF, BRIGHT_STARS, MESSIER
}

// Naked-eye "bright star" cutoff — real astronomical convention (lower
// magnitude = brighter; ~2.0 is a standard threshold for the brightest,
// most recognizable stars).
const BRIGHT_STAR_MAGNITUDE_LIMIT = 2.0;

interface ResolvedLabel {
  renderedY: number;
  needsLeaderLine: boolean;
}

// Stacks overlapping body labels (e.g. Mercury sitting almost exactly on
// top of the Sun from Earth's sky) into a vertically staggered column with
// a short leader line back to the actual marker, instead of drawing
// unreadable overlapping text. Operates on each body's *label* position
// (marker y minus the label's fixed offset), not the marker itself — the
// marker stays exactly where it astronomically belongs either way.
function resolveLabelCollisions(
  points: { key: string; x: number; labelY: number }[],
  minSpacing = 22,
  maxDx = 40
): Map<string, ResolvedLabel> {
  const sorted = [...points].sort((a, b) => a.labelY - b.labelY);
  const resolved = new Map<string, ResolvedLabel>();
  let lastX = Number.NEGATIVE_INFINITY;
  let lastRenderedY = Number.NEGATIVE_INFINITY;
  for (const p of sorted) {
    const collides = Math.abs(p.x - lastX) < maxDx && p.labelY - lastRenderedY < minSpacing;
    const renderedY = collides ? lastRenderedY + minSpacing : p.labelY;
    resolved.set(p.key, { renderedY, needsLeaderLine: collides });
    lastX = p.x;
    lastRenderedY = renderedY;
  }
  return resolved;
}

export default function StarTrackerView({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<LocationStatus>('requesting');
  // Real, live-tracked coords (GPS or the IP-geolocation fallback below) —
  // always kept up to date regardless of which observatory is selected,
  // so switching back to "Local Observer" is instant rather than needing
  // to re-run geolocation.
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });
  // Manual observatory override — 'local' defers entirely to the live
  // coords/status above; anything else is a fixed real-world site.
  const [selectedObservatoryId, setSelectedObservatoryId] = useState('local');
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

  const [skyFocusMode, setSkyFocusMode] = useState<SkyFocusMode>('OFF');
  const [skyMapsLoading, setSkyMapsLoading] = useState(false);
  const [skyMapsError, setSkyMapsError] = useState(false);
  const [constellationLines, setConstellationLines] = useState<ConstellationLine[] | null>(null);
  const [constellationNames, setConstellationNames] = useState<ConstellationNames | null>(null);
  const [stars, setStars] = useState<StarTuple[] | null>(null);

  const [skyFestOpen, setSkyFestOpen] = useState(false);
  const telescope = useTelescopeConnection();
  const [skyFestTab, setSkyFestTab] = useState<'eclipses' | 'meteors' | 'media'>('eclipses');

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [nowPlayingVideoId, setNowPlayingVideoId] = useState<string | null>(null);
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [playlistTitleInput, setPlaylistTitleInput] = useState('');
  const [playlistFormError, setPlaylistFormError] = useState('');

  // Real YT.Player instance (not a plain <iframe>) — needed so onReady can
  // actually call setVolume(); a bare iframe src has no JS handle at all.
  // Same pattern PodsModule.tsx already uses for its Broadcast Monitor.
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (skyFestTab !== 'media' || !nowPlayingVideoId) return;
    let cancelled = false;

    const bindPlayer = () => {
      if (cancelled || !ytContainerRef.current) return;
      ytContainerRef.current.replaceChildren();
      const playerHost = document.createElement('div');
      playerHost.style.width = '100%';
      playerHost.style.height = '100%';
      ytContainerRef.current.appendChild(playerHost);
      ytPlayerRef.current = new window.YT!.Player(playerHost, {
        videoId: nowPlayingVideoId,
        playerVars: { autoplay: 1 },
        events: {
          // Loads at a lower default rather than full blast — native
          // controls stay fully visible/enabled for manual adjustment
          // from there.
          onReady: (event) => event.target.setVolume(70),
        },
      });
    };

    if (window.YT?.Player) {
      bindPlayer();
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        bindPlayer();
      };
      if (!document.getElementById('youtube-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
      ytContainerRef.current?.replaceChildren();
    };
    // Re-binds a fresh player on every video/tab change rather than
    // reusing one via loadVideoById — this container can itself unmount
    // (switching Sky Fest tabs, or back to the "paste a link" placeholder
    // when nowPlayingVideoId is cleared), so a single long-lived instance
    // isn't a safe assumption here the way it is in PodsModule's
    // always-mounted Broadcast Monitor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlayingVideoId, skyFestTab]);

  useEffect(() => {
    queueMicrotask(() => setPlaylist(listPlaylist()));
  }, []);

  useEffect(() => {
    let cancelled = false;

    // City-level fallback when GPS is denied/unavailable — real public
    // service (ipapi.co, no key required for this volume), not a
    // fabricated endpoint. Genuinely less precise than GPS, so this is
    // labeled 'ip-fallback' rather than 'granted'; if it also fails, this
    // falls through to the honest "location unavailable, showing sky at
    // 0°N, 0°E" state that already existed.
    const tryIpFallback = async (deniedStatus: 'denied' | 'unavailable') => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error(`ipapi.co responded ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          setCoords({ lat: data.latitude, lon: data.longitude });
          setStatus('ip-fallback');
        } else {
          setStatus(deniedStatus);
        }
      } catch {
        if (!cancelled) setStatus(deniedStatus);
      }
    };

    if (!navigator.geolocation) {
      tryIpFallback('unavailable');
      return () => {
        cancelled = true;
      };
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus('granted');
      },
      () => tryIpFallback('denied'),
      { timeout: 8000 }
    );

    return () => {
      cancelled = true;
    };
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

  // Constellation/star data is ~46KB total — fetched lazily on first toggle
  // rather than on mount, and cached in state afterward so switching the
  // layer off and back on doesn't re-fetch.
  useEffect(() => {
    if (skyFocusMode === 'OFF' || constellationLines) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSkyMapsLoading(true);
    });
    Promise.all([loadConstellationLines(), loadConstellationNames(), loadStars()])
      .then(([lines, names, starData]) => {
        if (cancelled) return;
        setConstellationLines(lines);
        setConstellationNames(names);
        setStars(starData);
        setSkyMapsError(false);
      })
      .catch(() => {
        if (!cancelled) setSkyMapsError(true);
      })
      .finally(() => {
        if (!cancelled) setSkyMapsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skyFocusMode, constellationLines]);

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

  const selectedObservatory = OBSERVATORIES.find((o) => o.id === selectedObservatoryId) ?? OBSERVATORIES[0];
  const isCustomObservatory = selectedObservatory.id !== 'local';
  // 'local' always uses the real, live-tracked coords — a preset
  // observatory's own lat/lon/elevation only ever apply when one is
  // actually selected.
  const effectiveCoords = isCustomObservatory ? { lat: selectedObservatory.lat, lon: selectedObservatory.lon } : coords;
  const effectiveElevationKm = isCustomObservatory ? selectedObservatory.elevationMeters / 1000 : 0;

  const observer = useMemo(
    () => new Observer(effectiveCoords.lat, effectiveCoords.lon, effectiveElevationKm),
    [effectiveCoords.lat, effectiveCoords.lon, effectiveElevationKm]
  );
  const sky = useMemo(() => computeSky(observer, now), [observer, now]);
  const visible = sky.filter((b) => b.altitude > 0);
  const belowHorizon = sky.filter((b) => b.altitude <= 0);

  const issTopo = useMemo(() => {
    if (!iss) return null;
    return topocentricPosition(
      { latitude: effectiveCoords.lat, longitude: effectiveCoords.lon, altitude: effectiveElevationKm },
      iss.geo
    );
  }, [iss, effectiveCoords, effectiveElevationKm]);

  const cosmic = calculateCosmicTime();
  const locationLabel = isCustomObservatory
    ? `${selectedObservatory.name} — ${effectiveCoords.lat.toFixed(2)}°, ${effectiveCoords.lon.toFixed(2)}° · Elev ${selectedObservatory.elevationMeters}m`
    : status === 'granted'
      ? `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`
      : status === 'ip-fallback'
        ? `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}° (approximate, from IP)`
        : status === 'requesting'
          ? 'Locating…'
          : 'Location unavailable — showing sky at 0°N, 0°E';

  // Dome geometry + pan/zoom handlers
  // Logical SVG units, not pixels — the viewBox keeps all coordinate math
  // (azAltToXY etc.) correct regardless of the actual rendered size, which
  // is now driven entirely by the CSS below (w-full + aspect-square) rather
  // than a fixed pixel cap.
  const size = 500;
  const center = size / 2;
  const radius = size / 2 - 24;

  // Resolves overlapping body labels (e.g. Mercury sitting almost exactly
  // on the Sun from Earth's sky) into a staggered column with leader
  // lines — see resolveLabelCollisions above.
  const resolvedLabels = useMemo(
    () =>
      resolveLabelCollisions(
        visible.map((b) => {
          const { x, y } = azAltToXY(b.azimuth, b.altitude, center, radius);
          return { key: b.name, x, labelY: y - 9 };
        })
      ),
    [visible, center, radius]
  );

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

  const eclipses = useMemo<UpcomingEclipse[]>(() => getUpcomingEclipses(now, 2), [now]);
  const meteorShowers = useMemo<UpcomingMeteorShower[]>(() => getUpcomingMeteorShowers(now, 4), [now]);

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
        <div className="space-y-3">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/80">Sky Above You</span>
            <h2 className="text-2xl font-bold tracking-wider text-white">Star Tracker</h2>
            <p className="mt-1 font-mono text-xs text-cyan-100/80">{locationLabel}</p>
          </div>
          <ObservatoryPicker selectedId={selectedObservatoryId} onSelectObservatory={(obs: Observatory) => setSelectedObservatoryId(obs.id)} />
        </div>

        {/* Time Sync header */}
        <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg border-cyan-500/20 bg-black/30">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Local Time</div>
            <div className="font-mono text-sm text-white">{now.toLocaleTimeString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Sidereal Time</div>
            <div className="font-mono text-sm text-cyan-300">{localSiderealTime(now, effectiveCoords.lon)}</div>
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
          <div className="relative flex items-center">
            <Sparkles className="absolute w-3 h-3 pointer-events-none left-2.5 text-cyan-300" />
            <select
              value={skyFocusMode}
              onChange={(e) => setSkyFocusMode(e.target.value as SkyFocusMode)}
              title="Double-click the sky dome to reset pan/zoom"
              className={`appearance-none pl-7 pr-2 py-1 text-[10px] font-mono uppercase tracking-wide rounded-full border transition cursor-pointer ${
                skyFocusMode !== 'OFF'
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <option value="OFF">Sky Maps: Off</option>
              <option value="BIG_DIPPER">Big Dipper / Polaris</option>
              <option value="ZODIAC">Zodiac / Ecliptic</option>
              <option value="BRIGHT_STARS">Brightest Stars</option>
              <option value="MESSIER">Messier Deep-Sky</option>
              <option value="ALL">All Constellations</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setSkyFestOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded-full border transition ${
              skyFestOpen ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <CalendarClock className="w-3 h-3" />
            Sky Fest
          </button>
        </div>

        <TelescopeConnectPanel connection={telescope} />

        {skyFestOpen && (
          <div className="overflow-hidden border rounded-lg border-cyan-500/20 bg-black/30">
            <div className="flex border-b border-cyan-500/20">
              {(['eclipses', 'meteors', 'media'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSkyFestTab(tab)}
                  className={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wide transition ${
                    skyFestTab === tab ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'eclipses' ? '🌘 Eclipses' : tab === 'meteors' ? '☄️ Meteors' : '🛰️ Space Media'}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-2">
              {skyFestTab === 'eclipses' &&
                eclipses.map((e, i) => (
                  <div key={i} className="p-2 border rounded border-slate-800 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white capitalize">
                        {e.type} eclipse — {e.kind}
                      </span>
                      <span className="font-mono text-[10px] text-cyan-300">{daysUntil(now, e.peak)}d</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">
                      {e.peak.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {e.obscuration !== null && (
                      <p className="font-mono text-[11px] text-slate-400">Obscuration {(e.obscuration * 100).toFixed(0)}%</p>
                    )}
                    {e.latitude !== null && e.longitude !== null && (
                      <p className="font-mono text-[11px] text-slate-400">
                        Peak visibility near {e.latitude.toFixed(1)}°, {e.longitude.toFixed(1)}°
                      </p>
                    )}
                  </div>
                ))}

              {skyFestTab === 'meteors' &&
                meteorShowers.map((m) => (
                  <div key={m.name} className="p-2 border rounded border-slate-800 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{m.name}</span>
                      <span className="font-mono text-[10px] text-cyan-300">{daysUntil(now, m.nextPeak)}d</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">
                      Peaks {m.nextPeak.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · parent body: {m.parentBody}
                    </p>
                  </div>
                ))}

              {skyFestTab === 'media' && (
                <div className="space-y-3">
                  {nowPlayingVideoId ? (
                    <div className="relative w-full overflow-hidden bg-black rounded aspect-video">
                      {/* React owns this wrapper but never puts JSX children
                          inside it — YT.Player replaces whatever element
                          it's given with its own <iframe>, entirely outside
                          React's reconciliation (see the mount effect
                          above). */}
                      <div ref={ytContainerRef} className="absolute inset-0 w-full h-full" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center border rounded aspect-video border-slate-800 bg-slate-950/60">
                      <p className="px-4 text-xs text-center font-mono text-slate-500">
                        Paste a YouTube link below — Mars rover clips, Hubble highlights, any stream link — to save and play it here.
                      </p>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const videoId = parseYouTubeId(playlistUrlInput);
                      if (!videoId) {
                        setPlaylistFormError('That doesn’t look like a valid YouTube link.');
                        return;
                      }
                      // Falling back to the raw pasted URL as the title
                      // (the previous behavior here) meant an unnamed
                      // save showed a full youtube.com link in the chip
                      // instead of a clean label.
                      const cleanTitle = playlistTitleInput.trim() || `Space Stream #${playlist.length + 1}`;
                      setPlaylist(savePlaylistItem(cleanTitle, videoId));
                      setNowPlayingVideoId(videoId);
                      setPlaylistUrlInput('');
                      setPlaylistTitleInput('');
                      setPlaylistFormError('');
                    }}
                    className="flex flex-col gap-1.5 sm:flex-row"
                  >
                    <input
                      type="text"
                      value={playlistTitleInput}
                      onChange={(e) => setPlaylistTitleInput(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full sm:w-32 px-2 py-1.5 text-[11px] font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/50"
                    />
                    <input
                      type="text"
                      value={playlistUrlInput}
                      onChange={(e) => setPlaylistUrlInput(e.target.value)}
                      placeholder="Paste video link / YouTube URL"
                      className="flex-1 min-w-0 px-2 py-1.5 text-[11px] font-mono bg-black/60 border border-slate-800 rounded text-slate-100 placeholder-slate-600 outline-none focus:border-white/50"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded bg-white text-black hover:bg-neutral-200 whitespace-nowrap"
                    >
                      Add to Playlist
                    </button>
                  </form>
                  {playlistFormError && <p className="font-mono text-[10px] text-red-400">{playlistFormError}</p>}

                  {playlist.length > 0 && (
                    <div className="space-y-1">
                      {playlist.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 border rounded ${
                            item.videoId === nowPlayingVideoId ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setNowPlayingVideoId(item.videoId)}
                            className="flex-1 min-w-0 text-xs text-left truncate text-slate-100 hover:text-white"
                          >
                            {item.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlaylist(removePlaylistItem(item.id))}
                            className="text-slate-600 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="font-mono text-[10px] text-slate-600">
                    Live comet tracking isn&apos;t included — no free, reliable live data source exists for it. Saved links are
                    stored in this browser only.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

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
          <div className="p-2 space-y-2 border rounded-lg border-cyan-500/20 bg-black/30">
            {issError ? (
              <p className="px-1 font-mono text-xs text-red-400">ISS position unavailable right now.</p>
            ) : iss && issTopo ? (
              <p className="px-1 font-mono text-xs text-cyan-100">
                ISS is {issTopo.altitude > 0 ? 'above your horizon' : 'below your horizon'} — {compassDirection(issTopo.azimuth)}
                {issTopo.altitude > 0 ? `, alt ${issTopo.altitude.toFixed(0)}°` : ''} · {iss.visibility}
              </p>
            ) : (
              <p className="px-1 font-mono text-xs text-slate-500">Locating ISS…</p>
            )}
            {/* Inline live feed — the same real NASA stream the header's
                "LIVE ISS" button opens, embedded here instead of a separate
                popup so it's part of this view. */}
            <div className="relative w-full overflow-hidden bg-black rounded aspect-video">
              <iframe
                className="absolute top-0 left-0 w-full h-full border-0"
                src={ISS_STREAM_URL}
                title="Live ISS HD Video Feed"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {skyFocusMode !== 'OFF' && (skyMapsLoading || skyMapsError) && (
          <div className="px-3 py-2 border rounded-lg border-cyan-500/20 bg-black/30">
            {skyMapsError ? (
              <p className="font-mono text-xs text-red-400">Constellation data unavailable right now.</p>
            ) : (
              <p className="font-mono text-xs text-slate-500">Loading constellations…</p>
            )}
          </div>
        )}

        <div className="p-4 border rounded-lg border-cyan-500/20 bg-black/30">
          <svg
            ref={domeRef}
            viewBox={`0 0 ${size} ${size}`}
            className="w-full aspect-square touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onDoubleClick={resetView}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} style={{ transformOrigin: `${center}px ${center}px` }}>
              <circle cx={center} cy={center} r={radius} fill="rgba(6,20,28,0.6)" stroke="rgba(34,211,238,0.3)" strokeWidth={1} />
              <circle cx={center} cy={center} r={radius * 0.5} fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth={1} />
              {/* Zenith marker — straight overhead, the center of this
                  projection by construction (altitude 90° maps to r=0). */}
              <g className="pointer-events-none">
                <line x1={center - 6} y1={center} x2={center + 6} y2={center} stroke="rgba(34,211,238,0.5)" strokeWidth={1} />
                <line x1={center} y1={center - 6} x2={center} y2={center + 6} stroke="rgba(34,211,238,0.5)" strokeWidth={1} />
                <text x={center} y={center + 16} textAnchor="middle" className="fill-cyan-500/50" fontSize={8} fontFamily="monospace">
                  ZENITH
                </text>
              </g>
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
              {skyFocusMode !== 'OFF' &&
                stars
                  ?.filter(([, , mag]) => skyFocusMode !== 'BRIGHT_STARS' || mag <= BRIGHT_STAR_MAGNITUDE_LIMIT)
                  .map(([lon, lat, mag], idx) => {
                    const xy = equatorialToXY(lonToRaHours(lon), lat, observer, now, center, radius);
                    if (!xy) return null;
                    // Brightest Stars mode draws the same real magnitude
                    // data larger/more prominent, since the whole point of
                    // that mode is to make the naked-eye-brightest stars
                    // easy to pick out rather than blending into the field.
                    const r =
                      skyFocusMode === 'BRIGHT_STARS' ? Math.max(1.2, 3.2 - mag * 0.5) : Math.max(0.4, 2.2 - mag * 0.35);
                    return (
                      <circle
                        key={idx}
                        cx={xy.x}
                        cy={xy.y}
                        r={r}
                        fill={skyFocusMode === 'BRIGHT_STARS' ? '#67e8f9' : '#e2e8f0'}
                        opacity={skyFocusMode === 'BRIGHT_STARS' ? 1 : 0.85}
                      />
                    );
                  })}
              {skyFocusMode !== 'OFF' &&
                skyFocusMode !== 'BRIGHT_STARS' &&
                skyFocusMode !== 'MESSIER' &&
                constellationLines
                  ?.filter((c) => shouldDrawConstellation(c.id, skyFocusMode))
                  .map((c) =>
                    c.lines.map((strip, stripIdx) =>
                      projectLineStrip(strip, observer, now, center, radius).map((run, runIdx) => (
                        <polyline
                          key={`${c.id}-${stripIdx}-${runIdx}`}
                          points={run.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={skyFocusMode === 'ALL' ? 'rgba(103,232,249,0.35)' : 'rgba(34,211,238,0.75)'}
                          strokeWidth={skyFocusMode === 'ALL' ? 0.75 : 1.5}
                          className="cursor-pointer hover:stroke-cyan-300"
                          onClick={() => setSelected({ kind: 'constellation', id: c.id })}
                        />
                      ))
                    )
                  )}
              {skyFocusMode === 'MESSIER' &&
                MESSIER_OBJECTS.map((m) => {
                  // Same real Horizon()-backed projection already used for
                  // the star catalog and constellation lines above — not a
                  // separate hand-rolled az/alt formula — using the live
                  // `now`/`observer`, not a fixed/simulated time.
                  const xy = equatorialToXY(m.raHours, m.decDeg, observer, now, center, radius);
                  if (!xy) return null;
                  return (
                    <g key={m.id} className="cursor-pointer">
                      <title>
                        {m.id} — {m.name} ({m.type}, mag {m.magnitude})
                      </title>
                      <rect
                        x={xy.x - 3}
                        y={xy.y - 3}
                        width={6}
                        height={6}
                        transform={`rotate(45 ${xy.x} ${xy.y})`}
                        fill="rgba(192,132,252,0.3)"
                        stroke="#c084fc"
                        strokeWidth={1}
                      />
                      <text
                        x={xy.x + 7}
                        y={xy.y + 3}
                        className="pointer-events-none fill-purple-300"
                        fontSize={8}
                        fontFamily="monospace"
                      >
                        {m.id}
                      </text>
                    </g>
                  );
                })}
              {visible.map((b) => {
                const { x, y } = azAltToXY(b.azimuth, b.altitude, center, radius);
                const isLuminary = b.name === 'Sun' || b.name === 'Moon';
                const label = resolvedLabels.get(b.name);
                const labelY = label?.renderedY ?? y - 9;
                return (
                  <g key={b.name} onClick={() => setSelected({ kind: 'body', body: b })} className="cursor-pointer">
                    <circle cx={x} cy={y} r={isLuminary ? 6 : 4.5} fill={isLuminary ? '#67e8f9' : '#e2e8f0'} stroke="transparent" strokeWidth={8} />
                    {label?.needsLeaderLine && (
                      <line
                        x1={x}
                        y1={y - 9}
                        x2={x + 10}
                        y2={labelY - 4}
                        stroke="rgba(34,211,238,0.4)"
                        strokeWidth={1}
                        className="pointer-events-none"
                      />
                    )}
                    <text
                      x={label?.needsLeaderLine ? x + 14 : x}
                      y={labelY}
                      textAnchor={label?.needsLeaderLine ? 'start' : 'middle'}
                      className="pointer-events-none fill-slate-300"
                      fontSize={9}
                      fontFamily="monospace"
                    >
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
              {(telescope.mode === 'connected' || telescope.mode === 'simulator') &&
                telescope.position &&
                (() => {
                  const xy = equatorialToXY(telescope.position.raHours, telescope.position.decDeg, observer, now, center, radius);
                  if (!xy) return null;
                  return (
                    <g className="pointer-events-none">
                      <circle
                        cx={xy.x}
                        cy={xy.y}
                        r={telescope.slewing ? 10 : 8}
                        fill="none"
                        stroke={telescope.slewing ? '#c084fc' : '#22d3ee'}
                        strokeWidth={1.5}
                        strokeDasharray={telescope.slewing ? '3 2' : undefined}
                      />
                      <line x1={xy.x - 13} y1={xy.y} x2={xy.x - 5} y2={xy.y} stroke={telescope.slewing ? '#c084fc' : '#22d3ee'} strokeWidth={1.5} />
                      <line x1={xy.x + 5} y1={xy.y} x2={xy.x + 13} y2={xy.y} stroke={telescope.slewing ? '#c084fc' : '#22d3ee'} strokeWidth={1.5} />
                      <line x1={xy.x} y1={xy.y - 13} x2={xy.x} y2={xy.y - 5} stroke={telescope.slewing ? '#c084fc' : '#22d3ee'} strokeWidth={1.5} />
                      <line x1={xy.x} y1={xy.y + 5} x2={xy.x} y2={xy.y + 13} stroke={telescope.slewing ? '#c084fc' : '#22d3ee'} strokeWidth={1.5} />
                      <text x={xy.x} y={xy.y + 24} textAnchor="middle" fill={telescope.slewing ? '#c084fc' : '#22d3ee'} fontSize={8} fontFamily="monospace">
                        {telescope.slewing ? 'SLEWING' : 'SCOPE'}
                      </text>
                    </g>
                  );
                })()}
            </g>
          </svg>
        </div>

        {/* Map key — only covers what's actually drawn above, nothing invented */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#67e8f9]" /> Sun / Moon
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#e2e8f0]" /> Planet
          </span>
          {skyFocusMode !== 'OFF' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e2e8f0] opacity-85" />
              {skyFocusMode === 'BRIGHT_STARS' ? 'Bright star (mag ≤ 2.0)' : 'Background star (larger = brighter)'}
            </span>
          )}
          {skyFocusMode !== 'OFF' && skyFocusMode !== 'BRIGHT_STARS' && skyFocusMode !== 'MESSIER' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-px bg-cyan-400/40" /> Constellation line (click to identify)
            </span>
          )}
          {skyFocusMode === 'MESSIER' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rotate-45 border border-purple-400 bg-purple-500/30" /> Messier object (hover for name)
            </span>
          )}
          {issLayerOn && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-[#22d3ee]" /> ISS
            </span>
          )}
          {(telescope.mode === 'connected' || telescope.mode === 'simulator') && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 border rounded-full border-cyan-400" /> Telescope target
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 border rounded-full border-cyan-500/50" /> Zenith (straight overhead)
          </span>
          <span>N/E/S/W = compass direction along the horizon</span>
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
            ) : selected.kind === 'iss' ? (
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
            ) : (
              constellationNames?.[selected.id] && (
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">{constellationNames[selected.id].name}</h3>
                  <p className="font-mono text-xs text-cyan-100">Genitive: {constellationNames[selected.id].genitive}</p>
                  <p className="font-mono text-xs text-cyan-100">IAU designation: {selected.id}</p>
                  <p className="font-mono text-xs text-slate-400">Brightness rank: {constellationNames[selected.id].rank}</p>
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
