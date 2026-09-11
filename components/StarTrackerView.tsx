'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarClock, HelpCircle, Mic, Satellite, Sparkles, Sun as SunIcon, Volume2, X } from 'lucide-react';
import { Body as AstroBody, Equator, Horizon, Illumination, Observer, SearchRiseSet } from 'astronomy-engine';
import { calculateCosmicTime } from '@/lib/cosmicMath';
import { localSiderealTime } from '@/lib/siderealTime';
import { useIssTracker } from '@/lib/useIssTracker';
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
import { listPlaylist, parseYouTubeId, removePlaylistItem, savePlaylistItem, type PlaylistItem } from '@/lib/spaceMediaPlaylist';
import type { YouTubePlayer } from '@/lib/youtubeIframeApi';
import { MESSIER_OBJECTS, type MessierObject } from '@/lib/messierCatalog';
import ObservatoryPicker, { OBSERVATORIES, type Observatory } from './ObservatoryPicker';
import { useTelescopeConnection } from '@/lib/useTelescopeConnection';
import TelescopeConnectPanel from './telescope/TelescopeConnectPanel';
import InfoTooltip from './InfoTooltip';
import { useSpeechToText } from './useSpeechToText';
import Starfield from './Starfield';
import { TelemetryGauges } from './hud/TelemetryGauges';
import { SystemMetricsGauges } from './hud/SystemMetricsGauges';
import { TargetAlignmentDiagnostics } from './hud/TargetAlignmentDiagnostics';
import { HudControlPanel } from './hud/HudControlPanel';
import DsnTelemetryPanel from './hud/DsnTelemetryPanel';
import DeepSkySpectrumPanel from './hud/DeepSkySpectrumPanel';
import { useProCoreConnection } from '@/lib/useProCoreConnection';

// The same real NASA ISS live feed already used by ISSFeedModal (the
// header's "LIVE ISS" button) — reused here so the video is inline inside
// Star Tracker's ISS layer instead of a separate popup elsewhere in the app.
const ISS_STREAM_URL = 'https://www.youtube.com/embed/awQzjn72bI0';

// A real ISS interior tour — "ISS Tour: Kitchen, Bedrooms & The
// Latrine" (https://www.youtube.com/watch?v=XkM_04Ch76E), verified before
// use. The one-time Space Media playlist seed below (first-ever-visit
// only, see that effect's own comment) uses this specific video, not the
// live ISS_STREAM_URL feed above — they're deliberately different: that
// one is the real-time NASA stream for the ISS tracking layer, this is a
// real recorded tour for Space Media's own default.
const DEFAULT_SPACE_MEDIA_VIDEO_ID = 'XkM_04Ch76E';

// Bronze/gold "Tactile Bronze/Gold and Green Lightwork" theme — the metal
// housing gradient/shadow applied to every physical-instrument surface
// (bezel, dome frame, Ask Kali bar frame), and the single green used for
// every data-driven readout (cardinal points, tick marks, ZENITH, Venus/
// Saturn labels, voice-bar input text) so the whole instrument reads as one
// consistent metal-and-light object rather than a patchwork of accents.
const HOUSING_GRADIENT =
  'linear-gradient(135deg, #6b4f16 0%, #BF9B30 22%, #F0D68A 45%, #BF9B30 68%, #8a6a20 88%, #5c4412 100%)';
const HOUSING_SHADOW =
  'inset 0 1px 1px rgba(255,241,199,0.5), inset 0 -3px 6px rgba(0,0,0,0.65), 0 10px 24px -8px rgba(0,0,0,0.8)';
const HOUSING_SHADOW_SM =
  'inset 0 1px 1px rgba(255,241,199,0.45), inset 0 -2px 4px rgba(0,0,0,0.6), 0 6px 16px -6px rgba(0,0,0,0.75)';
const LIGHTWORK_GREEN = '#33CCCC';

// Literal first-contact line — both the input's placeholder and the greeting
// spoken aloud once on mount (see the mount effect near speakNarrative
// below), kept as one constant so the two can't drift apart.
const KALI_GREETING = "Welcome. I'm Kali, What's on your mind?";

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

// Real, static classification facts — not sensor-derived, just what each
// body actually is. "Spectral type" only applies to the Sun (a real star);
// the others get their real physical classification instead.
const BODY_TYPE_FACTS: Record<string, string> = {
  Sun: 'G2V main-sequence star',
  Moon: "Earth's natural satellite",
  Mercury: 'Terrestrial planet',
  Venus: 'Terrestrial planet',
  Mars: 'Terrestrial planet',
  Jupiter: 'Gas giant',
  Saturn: 'Gas giant, ringed',
};

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

function formatLightYears(ly: number): string {
  if (ly >= 1_000_000) return `${(ly / 1_000_000).toFixed(1)} million ly`;
  return `${ly.toLocaleString()} ly`;
}

// Same format TelescopeConnectPanel already uses for the mount's live
// position — reused here for TargetAlignmentDiagnostics' commanded-target
// readout so the two RA/Dec displays in this view read consistently.
function formatTargetRa(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
function formatTargetDec(deg: number): string {
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}'`;
}

// NASA's Hubble Messier Catalog pages key off the bare catalog number, not
// the "M" prefix (verified against the real M42 page before wiring this in).
function messierArchiveUrl(id: string): string {
  const number = id.replace(/^M/i, '');
  return `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${number}/`;
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
type SelectedItem =
  | { kind: 'body'; body: SkyBody }
  | { kind: 'iss' }
  | { kind: 'constellation'; id: string }
  | { kind: 'messier'; object: MessierObject }
  | null;

// Stable identity for a selection, independent of object reference — bodies
// are recomputed (new object identity) on every `now` tick, so effects that
// should only re-fire on a genuine change of *what's* selected (not just a
// clock tick) key off this instead of `selected` itself.
function selectionKey(item: SelectedItem): string | null {
  if (!item) return null;
  if (item.kind === 'body') return `body:${item.body.name}`;
  if (item.kind === 'messier') return `messier:${item.object.id}`;
  if (item.kind === 'constellation') return `constellation:${item.id}`;
  return 'iss';
}

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

interface StarTrackerViewProps {
  onBack: () => void;
  // Real cross-view handoff to Kali chat — see InfoTooltip's askKaliQuery
  // prop and AiOneChat's prefillQuery prop. Optional: the standalone
  // /star-tracker route has no parent shell (no Kali anywhere on that
  // domain) and simply omits it, which hides the "Ask Kali" row entirely
  // rather than rendering a button that goes nowhere.
  onAskKali?: (query: string) => void;
}

export default function StarTrackerView({ onBack, onAskKali }: StarTrackerViewProps) {
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
  // Casual/Expert only change how much of the already-real data is shown
  // (plain description vs full RA/Dec/magnitude/rise-set readout) — no
  // separate data source, no simulated telemetry either mode.
  const [hudMode, setHudMode] = useState<'casual' | 'expert'>('expert');
  // Hover-only (not click-persisted like `selected` above) — which Messier
  // diamond currently has its dark-themed preview overlay showing.
  const [hoveredMessierId, setHoveredMessierId] = useState<string | null>(null);
  // Fires once real location is resolved, so the detail panel isn't empty
  // on first load and Casual/Expert has something to visibly act on right
  // away. Picks whichever real body is actually most prominent right now —
  // not a fixed "always the Sun" default.
  const hasAutoSelectedRef = useRef(false);

  // Pan/zoom state for the sky dome — drag to pan, wheel to zoom.
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const domeRef = useRef<SVGSVGElement | null>(null);

  // Quick Start tour — see the tourSteps/tour-overlay block further down.
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);
  const askKaliBarRef = useRef<HTMLDivElement | null>(null);
  const messierToggleRef = useRef<HTMLDivElement | null>(null);
  const telescopeConnectRef = useRef<HTMLDivElement | null>(null);

  // Inline Kali narrative — real /api/ai-one-chat calls, spoken via
  // window.speechSynthesis (same voice config as AiOneChat's toggleSpeak),
  // triggered automatically on target selection and from the voice bar.
  const [narrativeText, setNarrativeText] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [narrativeError, setNarrativeError] = useState('');
  const [voiceQuery, setVoiceQuery] = useState('');
  const narrativeAbortRef = useRef<AbortController | null>(null);

  const [issLayerOn, setIssLayerOn] = useState(false);

  const [spaceWeatherOn, setSpaceWeatherOn] = useState(false);
  const [kp, setKp] = useState<KpReading | null>(null);
  const [kpError, setKpError] = useState(false);

  const [skyFocusMode, setSkyFocusMode] = useState<SkyFocusMode>('MESSIER');
  const [skyMapsLoading, setSkyMapsLoading] = useState(false);
  const [skyMapsError, setSkyMapsError] = useState(false);
  const [constellationLines, setConstellationLines] = useState<ConstellationLine[] | null>(null);
  const [constellationNames, setConstellationNames] = useState<ConstellationNames | null>(null);
  const [stars, setStars] = useState<StarTuple[] | null>(null);

  const [skyFestOpen, setSkyFestOpen] = useState(true);
  const telescope = useTelescopeConnection();
  const [skyFestTab, setSkyFestTab] = useState<'dsn' | 'deepsky' | 'media'>('media');
  // Real local UI preference (Phase 4 HUD controls) — directly sets this
  // panel's own backdrop opacity below, nothing fabricated or hardware-linked.
  const [hudOpacity, setHudOpacity] = useState(1);

  // SystemMetricsGauges data. Both the quantum-service ping and the
  // pro-core WS connection below only run while the Sky Fest panel is open
  // (skyFestOpen gates both) — no background network activity for visitors
  // who never open the panel that displays them.
  const [quantumLatencyMs, setQuantumLatencyMs] = useState<number | null>(null);
  useEffect(() => {
    if (!skyFestOpen) {
      setQuantumLatencyMs(null);
      return;
    }
    let cancelled = false;
    const ping = () => {
      fetch('/api/quantum-service/health')
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setQuantumLatencyMs(typeof data.latencyMs === 'number' ? data.latencyMs : null);
        })
        .catch(() => {
          if (!cancelled) setQuantumLatencyMs(null);
        });
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [skyFestOpen]);

  const { wsConnected: proCoreConnected, connectedSince: proCoreConnectedSince } = useProCoreConnection(skyFestOpen);
  const [sessionDurationSec, setSessionDurationSec] = useState<number | null>(null);
  useEffect(() => {
    if (!proCoreConnected || proCoreConnectedSince === null) {
      setSessionDurationSec(null);
      return;
    }
    const update = () => setSessionDurationSec(Math.floor((Date.now() - proCoreConnectedSince) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proCoreConnected, proCoreConnectedSince]);

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
        // mute: 1 is what actually makes autoplay work — every major
        // browser blocks unmuted autoplay outright, muted or not is the
        // real gate here, not autoplay alone (the YT IFrame Player API's
        // equivalent of a plain <video>'s autoPlay+muted+playsInline,
        // which don't apply to an <iframe>-based embed like this one).
        playerVars: { autoplay: 1, mute: 1, playsinline: 1 },
        events: {
          // Starts muted (browser-required for autoplay) at a lower
          // default volume rather than full blast, so unmuting via the
          // native controls doesn't blast full volume — controls stay
          // fully visible/enabled for manual adjustment either way.
          onReady: (event) => {
            event.target.mute();
            event.target.setVolume(70);
          },
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
    queueMicrotask(() => {
      const existing = listPlaylist();
      if (existing.length > 0) {
        // A returning visitor's own real saved videos — never overwritten
        // or auto-selected over. spaceMediaPlaylist.ts is deliberately
        // "no hardcoded videos"; the one-time seed below only ever runs
        // against a genuinely empty (first-ever-visit) playlist.
        setPlaylist(existing);
        return;
      }
      const seeded = savePlaylistItem('Space Stream #1', DEFAULT_SPACE_MEDIA_VIDEO_ID);
      setPlaylist(seeded);
      setNowPlayingVideoId(DEFAULT_SPACE_MEDIA_VIDEO_ID);
    });
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

  // Auto-select a default target once real location is known — waits on
  // `status` leaving 'requesting' so this doesn't fire against the
  // placeholder {lat:0, lon:0} coords and pick the wrong body. Sun during
  // the day, Moon at night, else the brightest currently-visible planet,
  // else just whatever's highest/least-below-horizon if nothing is up.
  useEffect(() => {
    if (hasAutoSelectedRef.current || status === 'requesting' || sky.length === 0) return;
    hasAutoSelectedRef.current = true;
    const sunBody = sky.find((b) => b.name === AstroBody.Sun);
    const moonBody = sky.find((b) => b.name === AstroBody.Moon);
    let defaultBody: SkyBody | undefined;
    if (sunBody && sunBody.altitude > 0) {
      defaultBody = sunBody;
    } else if (moonBody && moonBody.altitude > 0) {
      defaultBody = moonBody;
    } else {
      const visiblePlanets = sky.filter((b) => b.altitude > 0 && b.magnitude !== null);
      defaultBody =
        visiblePlanets.length > 0
          ? visiblePlanets.reduce((brightest, b) => (b.magnitude! < brightest.magnitude! ? b : brightest))
          : sky[0];
    }
    if (defaultBody) setSelected({ kind: 'body', body: defaultBody });
  }, [sky, status]);

  // Real SGP4 propagation from a live CelesTrak TLE, not a REST position
  // poll — enabled only while the layer is toggled on (see useIssTracker's
  // own `enabled` param), so this app isn't fetching from CelesTrak or
  // running propagation in the background for a feature no one has opened.
  const issTracker = useIssTracker(
    { latitude: effectiveCoords.lat, longitude: effectiveCoords.lon, altitudeKm: effectiveElevationKm },
    1000,
    issLayerOn
  );

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
  // While a Messier diamond is hovered, the location line temporarily
  // reports a target lock on it instead — reverts the instant the hover
  // ends, since the underlying locationLabel above is unaffected.
  const hoveredMessier = hoveredMessierId ? MESSIER_OBJECTS.find((m) => m.id === hoveredMessierId) : null;
  const statusLine = hoveredMessier ? `🎯 TARGET LOCK: ${hoveredMessier.id} — ${hoveredMessier.name}` : locationLabel;

  // Dome geometry + pan/zoom handlers
  // Logical SVG units, not pixels — the viewBox keeps all coordinate math
  // (azAltToXY etc.) correct regardless of the actual rendered size, which
  // is now driven entirely by the CSS below (w-full + aspect-square) rather
  // than a fixed pixel cap.
  const size = 500;
  const center = size / 2;
  const radius = size / 2 - 24;
  // Holographic azimuth ring's own radius — inset a few px inside where the
  // outer bezel ring used to sit (radius + 8) so the N/E/S/W labels' glyph
  // width/height and drop-shadow halo (see the label loop below) land fully
  // inside the SVG viewBox instead of clipping against it at the cardinal
  // points, where they previously had almost no margin to spare.
  const azimuthRingR = radius + 6;
  const azimuthLabelR = radius + 16;

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
      setView((v) => ({ ...v, scale: Math.min(5, Math.max(1, v.scale - e.deltaY * 0.001)) }));
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
  const resetView = () => {
    setView({ scale: 1, tx: 0, ty: 0 });
  };

  // ---------- Inline Kali narrative (real /api/ai-one-chat + TTS) ----------

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Same voice config as AiOneChat's toggleSpeak — a consistent Kali "voice"
  // across the app rather than the browser's default TTS voice.
  const speakNarrative = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((v) => v.name.includes('Google UK English Female') || v.name.includes('Samantha')) ?? voices[0];
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // First-contact greeting: speaks KALI_GREETING aloud once, the first time
  // this view mounts — not a real Kali/API response (there's no query, no
  // fetch), just the literal placeholder text read aloud so voice output
  // isn't silent before the user's first message. Ref-guarded (not state)
  // so it can't re-fire on a re-render, and isSpeaking/onend above already
  // give this the same "on while speaking, off once done" lifecycle as any
  // other spoken response.
  const hasGreetedRef = useRef(false);
  useEffect(() => {
    if (hasGreetedRef.current) return;
    hasGreetedRef.current = true;
    speakNarrative(KALI_GREETING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires a real query at Kali and streams the response into narrativeText.
  // autoSpeak controls whether the complete answer is spoken once streaming
  // finishes — false for target selection (no autoplay on page load or on
  // clicking a marker; the text still appears, with an explicit Speak
  // button to hear it), true for an explicit voice/text query submitted in
  // the Ask Kali bar, which is itself already a deliberate user action. A
  // fresh call aborts whatever the previous one was doing — selecting a new
  // target, or sending a new voice query, should interrupt rather than
  // queue behind a stale request.
  const askKaliInline = async (query: string, autoSpeak: boolean) => {
    narrativeAbortRef.current?.abort();
    const controller = new AbortController();
    narrativeAbortRef.current = controller;

    stopSpeaking();
    setNarrativeError('');
    setNarrativeText('');
    setIsNarrating(true);

    try {
      const res = await fetch('/api/ai-one-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: query }], mode: 'synthesis', language: 'en', voiceMode: true }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('Kali did not respond.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setNarrativeText(full);
      }
      setIsNarrating(false);
      if (autoSpeak) speakNarrative(full);
    } catch (err) {
      if (controller.signal.aborted) return; // superseded by a newer request, not a real failure
      setIsNarrating(false);
      setNarrativeError(err instanceof Error ? err.message : 'Kali could not be reached.');
    }
  };

  // Builds the same kind of rich, grounded query the existing "Ask Kali →"
  // button already constructs (object name + position + magnitude/distance)
  // — reused here so the automatic on-canvas narrative and the button
  // elsewhere ask Kali equally well-grounded questions.
  const describeSelectedForKali = (item: SelectedItem): string | null => {
    if (!item) return null;
    if (item.kind === 'body') {
      return (
        `Tell me the story of ${item.body.name} — it's ${compassDirection(item.body.azimuth)} at ` +
        `${item.body.altitude.toFixed(1)}° altitude` +
        `${item.body.magnitude !== null ? `, magnitude ${item.body.magnitude.toFixed(2)}` : ''}, ` +
        `${formatDistance(item.body.distanceAu)} away. In two or three sentences, what is it and why does it matter?`
      );
    }
    if (item.kind === 'messier') {
      return (
        `Tell me the story of ${item.object.name} (${item.object.id}), a ${item.object.type} roughly ` +
        `${formatLightYears(item.object.distanceLy)} away. In two or three sentences, what is it and why does it matter?`
      );
    }
    if (item.kind === 'iss' && issTracker.telemetry) {
      return (
        `Tell me about the International Space Station — it's currently ${Math.round(issTracker.telemetry.rangeKm).toLocaleString()} km away, ` +
        `orbiting at ${Math.round(issTracker.telemetry.altitudeKm)} km altitude at ${issTracker.telemetry.velocityKmS.toFixed(2)} km/s. ` +
        `In two or three sentences, what's notable about it right now?`
      );
    }
    return null;
  };

  // Feeds the Deep Sky Spectrum tab (real multi-wavelength imagery for
  // whichever Messier object is actually selected on the map) — null for
  // every other selection kind/no selection, rather than falling back to an
  // arbitrary default target the user didn't actually pick.
  const deepSkyTarget =
    selected?.kind === 'messier'
      ? {
          id: selected.object.id,
          name: selected.object.name,
          raHours: selected.object.raHours,
          decDeg: selected.object.decDeg,
          type: selected.object.type,
          distanceLy: selected.object.distanceLy,
        }
      : null;

  // Auto-narrate whenever the *selected object itself* changes (not just a
  // clock tick recomputing the same body's position — see selectionKey).
  // Deliberately does NOT auto-zoom the lens anymore — selecting a marker
  // highlights it in place (see the detail panel + selected-state styling
  // on the markers themselves below) while keeping the wide 180° FOV, so
  // the user keeps full contextual awareness of the sky instead of losing
  // it to a tight zoomed-in crop. Manual zoom (wheel/drag) is still
  // available and unaffected. Narrative text still fetches/displays
  // on selection (useful, silent) — autoSpeak is false here specifically so
  // nothing plays on page load or on merely clicking a marker; hearing it
  // is an explicit Speak click.
  const selKey = selectionKey(selected);
  useEffect(() => {
    if (!selected) return;

    const query = describeSelectedForKali(selected);
    if (query) askKaliInline(query, false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  // Voice bar: mic (real speech-to-text, same hook AiOneChat's input uses)
  // appends to the text field rather than auto-submitting, so a transcript
  // can be reviewed/edited before it's sent — free-form questions here are
  // independent of canvas selection, so they don't drive the lens/zoom.
  const { isListening, toggleListening, hasSupport: hasMicSupport } = useSpeechToText((transcript) => {
    setVoiceQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });
  const submitVoiceQuery = () => {
    const q = voiceQuery.trim();
    if (!q) return;
    askKaliInline(q, true); // an explicit ask — speak the answer
    setVoiceQuery('');
  };

  // Speech never outlives this component — cancel on unmount, and abort any
  // in-flight Kali request so a late stream doesn't setState after unmount.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      narrativeAbortRef.current?.abort();
    };
  }, []);

  // ---------- Quick Start tour ----------
  // Lightweight and dependency-free: a CSS spotlight (a box-shadow large
  // enough to darken the whole viewport except a cutout matching the
  // target's real DOMRect) plus a callout with an arrow, rather than
  // pulling in a tour library for three steps.
  const tourSteps = [
    {
      ref: askKaliBarRef,
      message: "Type or tap the mic here to ask me anything about the sky — I'll speak the answer back to you.",
    },
    {
      ref: messierToggleRef,
      message: 'Switch Sky Maps to Messier Deep-Sky to reveal galaxies, nebulae, and clusters — click one to zoom in and hear its story.',
    },
    {
      ref: telescopeConnectRef,
      message: 'Got a real telescope? Connect it here and I can show its live position, or even slew it to a target.',
    },
  ];

  const endTour = () => {
    setTourActive(false);
    setTourRect(null);
  };

  // Tracks the current step's target element continuously (not a one-time
  // measurement) so the spotlight stays correctly placed through the
  // smooth-scroll-into-view below, a window resize, or any other layout
  // shift — a plain rAF loop is simpler and more robust here than wiring up
  // separate scroll/resize listeners.
  useEffect(() => {
    if (!tourActive) return;
    const step = tourSteps[tourStepIndex];
    const el = step?.ref.current;
    if (!el) {
      endTour();
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let frame: number;
    const track = () => {
      setTourRect(el.getBoundingClientRect());
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStepIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
      {/* Same shared animated starfield as the home page (fixed to the
          viewport, z-0, resolution-independent %-based positions so it
          resizes cleanly with no listener needed) — replaces this view's
          own previously-duplicated star implementation, so the background
          is now literally the same moving field as everywhere else in the
          app, visible around and through the lens below via the glass
          treatment on its housing. */}
      <Starfield />

      <div className="relative z-10 flex items-center gap-2 mb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            setTourStepIndex(0);
            setTourActive(true);
          }}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Quick Start
        </button>
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto space-y-6">
        <div className="space-y-3">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/80">Sky Above You</span>
            <h2 className="text-2xl font-bold tracking-wider text-white">Star Tracker PRO</h2>
            <p className="mt-1 font-mono text-xs text-cyan-100/80">{statusLine}</p>
          </div>
          <ObservatoryPicker selectedId={selectedObservatoryId} onSelectObservatory={(obs: Observatory) => setSelectedObservatoryId(obs.id)} />
        </div>

        {/* Time Sync header */}
        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg border-cyan-500/20 bg-black/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[backdrop-filter,box-shadow] duration-300">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Local Time</div>
            <div className="font-mono text-sm text-white">{now.toLocaleTimeString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
              <InfoTooltip
                term="Sidereal Time"
                explanation="Earth's rotation measured against the distant stars instead of the Sun. A sidereal day (~23h56m) is about 4 minutes shorter than a solar day, since Earth also moves along its orbit each day."
                askKaliQuery={`My local sidereal time is ${localSiderealTime(now, effectiveCoords.lon)} right now — what does that tell me about what's overhead?`}
                onAskKali={onAskKali}
              />
            </div>
            <div className="font-mono text-sm text-cyan-300">{localSiderealTime(now, effectiveCoords.lon)}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
              <InfoTooltip
                term="Kali Yuga Epoch"
                explanation="A 432,000-year cycle from Hindu cosmology, reckoned from 3102 BCE. This shows how far the current calendar year is through that cycle — a cosmological/calendrical reference, not a scientific measurement."
                askKaliQuery={`We're ${cosmic.kaliYugaProgressPercent}% through the current Kali Yuga cycle — tell me more about what that means.`}
                onAskKali={onAskKali}
              />
            </div>
            <div className="font-mono text-sm text-white">{cosmic.kaliYugaProgressPercent}%</div>
          </div>
        </div>

        {/* Layer toggles — spread with justify-between + a larger gap
            instead of a tight cluster, more breathing room on wide
            viewports while still wrapping cleanly on narrow ones. */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
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
          <div ref={messierToggleRef} className="relative flex items-center">
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
          {/* Casual/Expert only changes display density on the same real
              data below — not a separate feature or data source. */}
          <div className="flex items-center border rounded-full border-slate-700 overflow-hidden">
            {(['casual', 'expert'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setHudMode(m)}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wide transition ${
                  hudMode === m ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div ref={telescopeConnectRef}>
          <TelescopeConnectPanel connection={telescope} />
        </div>

        {skyFestOpen && (
          <div
            style={{ opacity: hudOpacity }}
            className="overflow-hidden border rounded-lg border-cyan-500/20 bg-black/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[backdrop-filter,box-shadow,opacity] duration-300"
          >
            {/* Live telemetry HUD — real data from useTelescopeConnection
                (see its own comments for exactly which fields are honestly
                derivable vs. genuinely unknown for real hardware), only
                shown once a telescope is actually connected. Sits above the
                event tabs below, which are unrelated and unchanged. */}
            <div className="p-3 border-b border-cyan-500/20">
              {telescope.mode === 'connected' || telescope.mode === 'simulator' ? (
                (() => {
                  const hor = telescope.position ? Horizon(now, observer, telescope.position.raHours, telescope.position.decDeg, 'normal') : null;
                  // Real conversion of the already-real targetDeltaDeg
                  // (Phase 1) to arcseconds — not a separate measurement.
                  const offAxisErrorArcsec = telescope.targetDeltaDeg !== null ? telescope.targetDeltaDeg * 3600 : null;
                  // Locked once the mount has actually stopped moving and
                  // landed inside a tight tolerance — matches the same 10"
                  // threshold the diagnostics readout below colors green at.
                  const isAligned = !telescope.slewing && offAxisErrorArcsec !== null && offAxisErrorArcsec < 10;
                  return (
                    <>
                      <TelemetryGauges
                        alt={hor ? hor.altitude : null}
                        az={hor ? hor.azimuth : null}
                        driftRate={telescope.driftRateArcsecPerSec}
                        isSlewing={telescope.slewing}
                        slewProgress={telescope.slewProgressPercent}
                        targetDelta={telescope.targetDeltaDeg}
                        etaSeconds={telescope.etaSeconds}
                      />
                      <TargetAlignmentDiagnostics
                        targetName={telescope.lastTargetName}
                        targetRa={telescope.lastTarget ? formatTargetRa(telescope.lastTarget.raHours) : null}
                        targetDec={telescope.lastTarget ? formatTargetDec(telescope.lastTarget.decDeg) : null}
                        offAxisErrorArcsec={offAxisErrorArcsec}
                        isAligned={isAligned}
                      />
                    </>
                  );
                })()
              ) : (
                <p className="text-xs text-center text-slate-500 font-mono py-2">
                  Connect a telescope above to see live position, drift, and slew telemetry here.
                </p>
              )}

              {/* Phase 2 — system/service health, independent of whether a
                  local telescope is connected above. */}
              <SystemMetricsGauges
                latencyMs={quantumLatencyMs}
                wsConnected={proCoreConnected}
                sessionDurationSec={sessionDurationSec}
              />

              {/* Phase 4 — HUD opacity is a real local preference; tracking
                  rate sends a real command (or sets real simulator state);
                  sensor gain stays permanently disabled (see component). */}
              <HudControlPanel
                hudOpacity={hudOpacity}
                onHudOpacityChange={setHudOpacity}
                trackingRate={telescope.trackingRate}
                supportedTrackingRates={telescope.supportedTrackingRates}
                onTrackingRateChange={telescope.setTrackingRate}
                isTelescopeConnected={telescope.mode === 'connected' || telescope.mode === 'simulator'}
              />
            </div>

            <div className="flex border-b border-cyan-500/20">
              {(['dsn', 'deepsky', 'media'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSkyFestTab(tab)}
                  className={`flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wide transition ${
                    skyFestTab === tab ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'dsn' ? '📡 DSN Telemetry' : tab === 'deepsky' ? '🌌 Deep Sky Spectrum' : '🛰️ Space Media'}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-2">
              {skyFestTab === 'dsn' && <DsnTelemetryPanel active={skyFestTab === 'dsn'} />}

              {skyFestTab === 'deepsky' && <DeepSkySpectrumPanel target={deepSkyTarget} />}

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
          <div className="px-3 py-2 border rounded-lg border-cyan-500/20 bg-black/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[backdrop-filter,box-shadow] duration-300">
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
          <div className="p-2 space-y-2 border rounded-lg border-cyan-500/20 bg-black/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[backdrop-filter,box-shadow] duration-300">
            {issTracker.error ? (
              <p className="px-1 font-mono text-xs text-red-400">ISS position unavailable right now.</p>
            ) : issTracker.telemetry ? (
              <p className="px-1 font-mono text-xs text-cyan-100">
                ISS is {issTracker.telemetry.elevation > 0 ? 'above your horizon' : 'below your horizon'} —{' '}
                {compassDirection(issTracker.telemetry.azimuth)}
                {issTracker.telemetry.elevation > 0 ? `, alt ${issTracker.telemetry.elevation.toFixed(0)}°` : ''} ·{' '}
                {issTracker.telemetry.velocityKmS.toFixed(2)} km/s
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
          <div className="px-3 py-2 border rounded-lg border-cyan-500/20 bg-black/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-[backdrop-filter,box-shadow] duration-300">
            {skyMapsError ? (
              <p className="font-mono text-xs text-red-400">Constellation data unavailable right now.</p>
            ) : (
              <p className="font-mono text-xs text-slate-500">Loading constellations…</p>
            )}
          </div>
        )}

        {/* Lens bezel — a stylized camera/telescope frame around the sky
            dome, not true photorealism (that needs a real photographed
            texture, which doesn't exist and can't be generated here). The
            outer ring's rotation is a real readout of view.scale (1x-5x,
            the same real wheel-zoom already wired to the dome below), not
            purely decorative. */}
        <div
          className="relative p-3 border rounded-2xl border-[#4a3610]"
          style={{ background: HOUSING_GRADIENT, boxShadow: HOUSING_SHADOW }}
        >
          {/* Green-coated-optics edge glare — fades in from the bezel rim,
              transparent at center so it doesn't wash out the reticle. */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, transparent 55%, rgba(16,185,129,0.15) 85%, rgba(6,78,59,0.3) 100%)' }}
          />
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${(view.scale - 1) * 60}deg)` }}
            aria-hidden="true"
          >
            {/* SVG stroke can't use a CSS gradient directly — a real
                <linearGradient> def is the only way to get the brushed
                gold look onto the bezel ring itself, not just its
                container's background. */}
            <defs>
              <linearGradient id="bezelGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6b4f16" />
                <stop offset="25%" stopColor="#F0D68A" />
                <stop offset="50%" stopColor="#BF9B30" />
                <stop offset="75%" stopColor="#F0D68A" />
                <stop offset="100%" stopColor="#5c4412" />
              </linearGradient>
            </defs>
            <circle cx={50} cy={50} r={48.5} fill="none" stroke="url(#bezelGoldGradient)" strokeWidth={2.5} />
            {/* Cardinal labels — letters only, no degree numbers (matches
                the inner holographic azimuth ring's own N/E/S/W/NE/etc
                convention, professional-instrument style rather than a
                basic numbered compass dial). N at top, azimuth increasing
                clockwise (E=90, S=180, W=270). */}
            {[
              { deg: 0, label: 'N' },
              { deg: 90, label: 'E' },
              { deg: 180, label: 'S' },
              { deg: 270, label: 'W' },
            ].map(({ deg, label }) => {
              const angle = (deg - 90) * (Math.PI / 180);
              const x = 50 + Math.cos(angle) * 38;
              const y = 50 + Math.sin(angle) * 38;
              // Counter-rotates against the outer ring's own rotation so
              // the label stays upright/readable at any zoom level,
              // instead of tipping over as the bezel spins.
              const counterRotateDeg = -(view.scale - 1) * 60;
              return (
                <text
                  key={deg}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={LIGHTWORK_GREEN}
                  fontSize={4}
                  fontFamily="monospace"
                  fontWeight="bold"
                  style={{
                    filter: `drop-shadow(0 0 1.5px ${LIGHTWORK_GREEN})`,
                    transform: `rotate(${counterRotateDeg}deg)`,
                    transformOrigin: `${x}px ${y}px`,
                  }}
                >
                  {label}
                </text>
              );
            })}
            {Array.from({ length: 32 }).map((_, i) => {
              const angle = (i / 32) * Math.PI * 2;
              const x1 = 50 + Math.cos(angle) * 46;
              const y1 = 50 + Math.sin(angle) * 46;
              const x2 = 50 + Math.cos(angle) * (i % 4 === 0 ? 42 : 44);
              const y2 = 50 + Math.sin(angle) * (i % 4 === 0 ? 42 : 44);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={LIGHTWORK_GREEN}
                  strokeOpacity={i % 4 === 0 ? 0.9 : 0.5}
                  strokeWidth={i % 4 === 0 ? 0.8 : 0.4}
                />
              );
            })}
          </svg>
          {/* Target FOV = Base FOV / Zoom Ratio — Base FOV is 180°, the
              real full horizon-to-zenith-to-horizon sweep this dome
              projects at 1x. A real, derived value, not an arbitrary one. */}
          <span className="absolute px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-widest rounded top-1 right-1 text-cyan-300/70 bg-black/40">
            {view.scale.toFixed(1)}× · FOV {(180 / view.scale).toFixed(0)}°
          </span>

          {/* On-canvas telemetry overlay — the selected target's key stats,
              directly over the lens rather than only in the panel below it.
              Only point-like selections have anything to show here. */}
          {selected && selected.kind !== 'constellation' && (
            <div className="absolute z-10 max-w-[55%] px-2 py-1.5 space-y-0.5 border rounded top-1 left-1 border-cyan-500/30 bg-black/50 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pointer-events-none animate-glass-fade-in">
              {selected.kind === 'body' && (
                <>
                  <div className="text-[9px] font-bold text-white font-mono">{selected.body.name}</div>
                  <div className="text-[8px] text-cyan-300/80 font-mono">
                    {compassDirection(selected.body.azimuth)} {selected.body.altitude.toFixed(1)}° · {formatDistance(selected.body.distanceAu)}
                  </div>
                </>
              )}
              {selected.kind === 'messier' && (
                <>
                  <div className="text-[9px] font-bold text-white font-mono">
                    {selected.object.id} · {selected.object.name}
                  </div>
                  <div className="text-[8px] text-cyan-300/80 font-mono">
                    {selected.object.type} · {formatLightYears(selected.object.distanceLy)}
                  </div>
                </>
              )}
              {selected.kind === 'iss' && issTracker.telemetry && (
                <>
                  <div className="text-[9px] font-bold text-white font-mono">International Space Station</div>
                  <div className="text-[8px] text-cyan-300/80 font-mono">
                    {Math.round(issTracker.telemetry.rangeKm).toLocaleString()} km · {issTracker.telemetry.velocityKmS.toFixed(2)} km/s
                  </div>
                </>
              )}
            </div>
          )}

          {/* Kali voice bar — real speech-to-text (mic) or typed text, real
              /api/ai-one-chat, spoken aloud. Free-form questions here are
              independent of canvas selection (no target to zoom to), unlike
              the automatic per-target narrative triggered by selection
              above. Anchored over the bottom edge of the lens, per the
              "directly on top of the canvas" placement. */}
          <div
            ref={askKaliBarRef}
            className="absolute z-10 -translate-x-1/2 bottom-2 left-1/2 w-[92%] rounded-lg p-[3px]"
            style={{ background: HOUSING_GRADIENT, boxShadow: HOUSING_SHADOW_SM }}
          >
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[7px] bg-black/90 backdrop-blur-md">
            {hasMicSupport && (
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Ask Kali by voice'}
                className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border ${
                  isListening
                    ? 'border-red-400 text-red-400 animate-pulse bg-red-500/10'
                    : 'border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                }`}
              >
                <Mic className="w-3 h-3" />
              </button>
            )}
            <input
              type="text"
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitVoiceQuery();
              }}
              placeholder={isListening ? 'Listening…' : KALI_GREETING}
              className="flex-1 min-w-0 text-[10px] font-mono placeholder-slate-500 bg-transparent outline-none"
              style={{ color: LIGHTWORK_GREEN }}
            />
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                title="Stop speaking"
                className="flex items-center justify-center w-6 h-6 text-cyan-300 shrink-0 animate-pulse"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={submitVoiceQuery}
              disabled={!voiceQuery.trim() || isNarrating}
              className="shrink-0 px-2 py-1 text-[9px] font-mono uppercase tracking-wide rounded text-cyan-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isNarrating ? '…' : 'Ask'}
            </button>
          </div>
          </div>

          <div
            className="p-[3px] rounded-lg"
            style={{ background: HOUSING_GRADIENT, boxShadow: HOUSING_SHADOW }}
          >
          <div className="relative p-4 overflow-hidden rounded-[9px] bg-[#050810] backdrop-blur-md transition-[backdrop-filter] duration-300">
          {/* Localized starfield specifically for the lens's own field of
              view — the housing above is deliberately solid/opaque metal
              (real brushed metal isn't see-through), so this is what
              actually satisfies "stars visible through the lens": the
              dome's circle fill is semi-transparent and sits directly on
              top of this, not on top of the opaque housing several layers
              back. */}
          <Starfield contained starCount={140} />
          <svg
            ref={domeRef}
            viewBox={`0 0 ${size} ${size}`}
            className="relative z-10 w-full aspect-square touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onDoubleClick={resetView}
          >
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} style={{ transformOrigin: `${center}px ${center}px` }}>
              {/* Lens glass — deliberately more transparent than before so
                  the shared home-page starfield behind this whole view
                  reads through the dome itself, not just around it. */}
              <circle cx={center} cy={center} r={radius} fill="rgba(2,6,23,0.3)" stroke={LIGHTWORK_GREEN} strokeOpacity={0.3} strokeWidth={1} />
              <circle cx={center} cy={center} r={radius * 0.5} fill="none" stroke={LIGHTWORK_GREEN} strokeOpacity={0.12} strokeWidth={1} />
              {/* Zenith marker — straight overhead, the center of this
                  projection by construction (altitude 90° maps to r=0). */}
              <g className="pointer-events-none">
                <line x1={center - 6} y1={center} x2={center + 6} y2={center} stroke={LIGHTWORK_GREEN} strokeOpacity={0.7} strokeWidth={1} />
                <line x1={center} y1={center - 6} x2={center} y2={center + 6} stroke={LIGHTWORK_GREEN} strokeOpacity={0.7} strokeWidth={1} />
                <text x={center} y={center + 16} textAnchor="middle" fill={LIGHTWORK_GREEN} fillOpacity={0.7} fontSize={8} fontFamily="monospace">
                  ZENITH
                </text>
              </g>
              {/* Holographic azimuth ring — replaces the plain N/E/S/W
                  labels. A glowing double ring at the horizon boundary,
                  15deg tick marks (major every 45deg), 8-point compass
                  labels, and a slow rotating highlight sweep for the
                  "holographic" feel. Real azimuth convention (0=N,
                  90=E clockwise), same as the rest of this view. */}
              <g className="pointer-events-none">
                <circle cx={center} cy={center} r={azimuthRingR} fill="none" stroke={LIGHTWORK_GREEN} strokeOpacity={0.15} strokeWidth={4} />
                <circle cx={center} cy={center} r={azimuthRingR} fill="none" stroke={LIGHTWORK_GREEN} strokeOpacity={0.5} strokeWidth={1} />
                {Array.from({ length: 24 }).map((_, i) => {
                  const deg = i * 15;
                  const angle = (deg - 90) * (Math.PI / 180);
                  const isMajor = deg % 45 === 0;
                  const outer = azimuthRingR + (isMajor ? 5 : 3);
                  const inner = azimuthRingR - (isMajor ? 5 : 3);
                  return (
                    <line
                      key={deg}
                      x1={center + Math.cos(angle) * outer}
                      y1={center + Math.sin(angle) * outer}
                      x2={center + Math.cos(angle) * inner}
                      y2={center + Math.sin(angle) * inner}
                      stroke={LIGHTWORK_GREEN}
                      strokeOpacity={isMajor ? 0.8 : 0.4}
                      strokeWidth={isMajor ? 1.2 : 0.6}
                    />
                  );
                })}
                {[
                  { deg: 0, label: 'N' },
                  { deg: 45, label: 'NE' },
                  { deg: 90, label: 'E' },
                  { deg: 135, label: 'SE' },
                  { deg: 180, label: 'S' },
                  { deg: 225, label: 'SW' },
                  { deg: 270, label: 'W' },
                  { deg: 315, label: 'NW' },
                ].map(({ deg, label }) => {
                  const angle = (deg - 90) * (Math.PI / 180);
                  const x = center + Math.cos(angle) * azimuthLabelR;
                  const y = center + Math.sin(angle) * azimuthLabelR;
                  return (
                    <text
                      key={label}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={LIGHTWORK_GREEN}
                      fillOpacity={label.length === 1 ? 1 : 0.7}
                      fontSize={label.length === 1 ? 10 : 7}
                      fontFamily="monospace"
                      fontWeight={label.length === 1 ? 'bold' : 'normal'}
                      style={{ filter: `drop-shadow(0 0 2px ${LIGHTWORK_GREEN})` }}
                    >
                      {label}
                    </text>
                  );
                })}
                {/* Rotating highlight sweep — purely decorative motion, not
                    tied to any real value, unlike the outer bezel ring. */}
                <g className="animate-azimuth-sweep" style={{ transformOrigin: `${center}px ${center}px` }}>
                  <circle
                    cx={center}
                    cy={center}
                    r={azimuthRingR}
                    fill="none"
                    stroke="rgba(103,232,249,0.9)"
                    strokeWidth={2}
                    strokeDasharray={`${azimuthRingR * 0.15} ${azimuthRingR * 6.13}`}
                  />
                </g>
              </g>
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
                  const isHovered = hoveredMessierId === m.id;
                  // Tooltip box in the same logical (viewBox) units as the
                  // dome itself, clamped so it never runs off the edge —
                  // above-right of the node by default, flipping to
                  // below/left near the dome's boundary.
                  const boxW = 148;
                  const boxH = 78;
                  const boxX = Math.min(Math.max(xy.x + 8, 4), size - boxW - 4);
                  const boxY = xy.y - boxH - 8 < 0 ? xy.y + 12 : xy.y - boxH - 8;
                  return (
                    <g
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => setSelected({ kind: 'messier', object: m })}
                      onMouseEnter={() => setHoveredMessierId(m.id)}
                      onMouseLeave={() => setHoveredMessierId((prev) => (prev === m.id ? null : prev))}
                    >
                      {/* Transparent, wider hit area — the visible diamond is
                          only 6x6, too small to reliably hover/click on its
                          own, matching the wider-stroke hit targets used for
                          the celestial-body markers below. */}
                      <circle cx={xy.x} cy={xy.y} r={9} fill="transparent" />
                      {isHovered && (
                        <circle
                          cx={xy.x}
                          cy={xy.y}
                          r={5}
                          fill="none"
                          stroke="#c084fc"
                          strokeWidth={1}
                          className="pointer-events-none animate-messier-pulse"
                        />
                      )}
                      <rect
                        x={xy.x - 3}
                        y={xy.y - 3}
                        width={6}
                        height={6}
                        transform={`rotate(45 ${xy.x} ${xy.y})`}
                        fill={isHovered ? 'rgba(192,132,252,0.55)' : 'rgba(192,132,252,0.3)'}
                        stroke="#c084fc"
                        strokeWidth={isHovered ? 1.5 : 1}
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
                      {isHovered && (
                        <foreignObject x={boxX} y={boxY} width={boxW} height={boxH} className="pointer-events-none">
                          <div className="p-2 space-y-0.5 text-[7px] font-mono leading-tight text-purple-100 border rounded shadow-lg border-purple-500/40 bg-slate-950/95">
                            <div className="text-[8px] font-bold text-white">🌌 {m.id} • Click to select and hear its story</div>
                            <div className="pt-0.5">{m.name} — {m.type}</div>
                            <div>Distance: {formatLightYears(m.distanceLy)}</div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              {visible.map((b) => {
                const { x, y } = azAltToXY(b.azimuth, b.altitude, center, radius);
                const isLuminary = b.name === 'Sun' || b.name === 'Moon';
                // Venus and Saturn keep pure bright-white dots (their real
                // brightness), but get the lightwork green treatment on
                // their text labels specifically, per the theme spec.
                const isLightworkLabeled = b.name === 'Venus' || b.name === 'Saturn';
                const label = resolvedLabels.get(b.name);
                const labelY = label?.renderedY ?? y - 9;
                const isSelected = selected?.kind === 'body' && selected.body.name === b.name;
                return (
                  <g key={b.name} onClick={() => setSelected({ kind: 'body', body: b })} className="cursor-pointer">
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={7}
                        fill="none"
                        stroke="rgba(34,211,238,0.9)"
                        strokeWidth={0.8}
                        className="pointer-events-none animate-target-pulse"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isLuminary ? 6 : 4.5}
                      fill={isLuminary ? '#67e8f9' : isLightworkLabeled ? '#FFFFFF' : '#e2e8f0'}
                      stroke="transparent"
                      strokeWidth={8}
                      style={{
                        filter: `drop-shadow(0 0 3px ${
                          isLuminary ? 'rgba(103,232,249,0.7)' : isLightworkLabeled ? 'rgba(255,255,255,0.85)' : 'rgba(226,232,240,0.6)'
                        })`,
                      }}
                    />
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
                      className={isLightworkLabeled ? 'pointer-events-none' : 'pointer-events-none fill-slate-300'}
                      fill={isLightworkLabeled ? LIGHTWORK_GREEN : undefined}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {b.name}
                    </text>
                  </g>
                );
              })}
              {issLayerOn && issTracker.trajectory.length > 1 && (
                <polyline
                  points={issTracker.trajectory
                    .map((p) => {
                      const { x, y } = azAltToXY(p.azimuth, p.elevation, center, radius);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgba(34,211,238,0.4)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  className="pointer-events-none"
                />
              )}
              {issLayerOn && issTracker.telemetry && issTracker.telemetry.elevation > 0 && (
                <g onClick={() => setSelected({ kind: 'iss' })} className="cursor-pointer">
                  {(() => {
                    const { x, y } = azAltToXY(issTracker.telemetry.azimuth, issTracker.telemetry.elevation, center, radius);
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
          </div>
          {!selected && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[10px] font-mono text-center rounded-full pointer-events-none bg-black/50 text-cyan-200/70 backdrop-blur-sm">
              Select any object on the sky dome to view telemetry
            </div>
          )}
        </div>

        {/* Map key — only covers what's actually drawn above, nothing invented */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-sm font-medium font-mono text-slate-200">
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
              <span className="inline-block w-2 h-2 rotate-45 border border-purple-400 bg-purple-500/30" /> Messier object (hover for details, click for NASA archive)
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
          <div className="relative p-4 border rounded-lg border-cyan-500/40 bg-cyan-950/20 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-12px_rgba(0,0,0,0.6)] animate-glass-fade-in">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute flex items-center justify-center w-6 h-6 rounded top-2 right-2 text-slate-400 hover:text-white hover:bg-black/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {selected.kind === 'body' ? (
              <>
                {hudMode === 'casual' ? (
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white">{selected.body.name}</h3>
                    <p className="text-xs text-slate-300">{BODY_TYPE_FACTS[selected.body.name] ?? 'Celestial object'}</p>
                    <p className="text-xs text-slate-300">
                      Look toward the {compassDirection(selected.body.azimuth)}
                      {selected.body.altitude > 0 ? ', up in the sky right now.' : ' — currently below your horizon.'}
                    </p>
                    <p className="text-xs text-slate-300">It&apos;s about {formatDistance(selected.body.distanceAu)} away.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">{selected.body.name}</h3>
                    <p className="font-mono text-xs text-cyan-100">{BODY_TYPE_FACTS[selected.body.name] ?? 'Celestial object'}</p>
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
                )}
                {onAskKali && (
                  <div className="flex justify-end pt-2 mt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        onAskKali(
                          `Tell me about ${selected.body.name} — it's ${compassDirection(selected.body.azimuth)} at ` +
                            `${selected.body.altitude.toFixed(1)}° altitude` +
                            `${selected.body.magnitude !== null ? `, magnitude ${selected.body.magnitude.toFixed(2)}` : ''}, ` +
                            `${formatDistance(selected.body.distanceAu)} away.`
                        )
                      }
                      className="text-[10px] text-cyan-400 font-mono hover:underline hover:text-cyan-300"
                    >
                      Ask Kali →
                    </button>
                  </div>
                )}
              </>
            ) : selected.kind === 'iss' ? (
              issTracker.telemetry && (
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">International Space Station</h3>
                  <p className="font-mono text-xs text-cyan-100">
                    {compassDirection(issTracker.telemetry.azimuth)} ({issTracker.telemetry.azimuth.toFixed(1)}°) · altitude{' '}
                    {issTracker.telemetry.elevation.toFixed(1)}°
                  </p>
                  <p className="font-mono text-xs text-cyan-100">Range {Math.round(issTracker.telemetry.rangeKm).toLocaleString()} km</p>
                  <p className="font-mono text-xs text-cyan-100">Orbital altitude {Math.round(issTracker.telemetry.altitudeKm)} km</p>
                  <p className="font-mono text-xs text-cyan-100">Velocity {issTracker.telemetry.velocityKmS.toFixed(2)} km/s</p>
                </div>
              )
            ) : selected.kind === 'messier' ? (
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  {selected.object.id} · {selected.object.name}
                </h3>
                <p className="font-mono text-xs text-cyan-100">{selected.object.type}</p>
                <p className="font-mono text-xs text-cyan-100">Distance {formatLightYears(selected.object.distanceLy)}</p>
                {selected.object.magnitude !== null && (
                  <p className="font-mono text-xs text-cyan-100">Magnitude {selected.object.magnitude.toFixed(2)}</p>
                )}
                <a
                  href={messierArchiveUrl(selected.object.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block pt-1 text-[10px] text-purple-300 font-mono hover:underline hover:text-purple-200"
                >
                  View in Hubble Messier archive →
                </a>
              </div>
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

            {/* Kali's inline narrative — real /api/ai-one-chat, fetched
                automatically by the selection effect above for any
                point-like target (constellations excluded, same as the
                lens auto-zoom) and shown here as it streams. It does NOT
                speak itself — no autoplay on page load or on merely
                clicking a marker. Hearing it aloud is always an explicit
                action: the Speak button below, or a query submitted
                through the Ask Kali bar. */}
            {selected.kind !== 'constellation' && (
              <div className="pt-2 mt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-purple-300/80">Kali</span>
                  {isSpeaking ? (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      title="Stop speaking"
                      className="flex items-center gap-1 text-[9px] font-mono text-cyan-300 hover:text-cyan-200"
                    >
                      <Volume2 className="w-3 h-3 animate-pulse" /> speaking…
                    </button>
                  ) : (
                    narrativeText &&
                    !isNarrating && (
                      <button
                        type="button"
                        onClick={() => speakNarrative(narrativeText)}
                        title="Speak this narrative aloud"
                        className="flex items-center gap-1 text-[9px] font-mono text-purple-300 hover:text-purple-200"
                      >
                        <Volume2 className="w-3 h-3" /> Speak
                      </button>
                    )
                  )}
                </div>
                {narrativeError ? (
                  <p className="text-xs text-red-400">{narrativeError}</p>
                ) : narrativeText ? (
                  <p className="text-xs leading-relaxed text-slate-200">{narrativeText}</p>
                ) : isNarrating ? (
                  <p className="text-xs text-slate-500">Kali is thinking…</p>
                ) : null}
              </div>
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

      {/* Quick Start tour overlay — a spotlight cutout over the real target
          element's DOMRect (tourRect), a callout box with Kali's 1-sentence
          prompt, and an arrow connecting the two. Renders above everything
          else on the page and captures all clicks itself, so the rest of
          the UI can't be accidentally triggered mid-tour; Skip/Next/Finish
          are the only interactive elements. */}
      {tourActive && tourRect && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute transition-all duration-300 border-2 rounded-lg pointer-events-none border-cyan-300 animate-tour-glow"
            style={{
              left: tourRect.left - 8,
              top: tourRect.top - 8,
              width: tourRect.width + 16,
              height: tourRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(2,6,16,0.8)',
            }}
          />
          {(() => {
            const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
            const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
            const calloutW = 280;
            const gap = 16;
            const spaceBelow = viewportH - tourRect.bottom;
            const placeAbove = spaceBelow < 160 && tourRect.top > 160;
            const top = placeAbove ? tourRect.top - gap : tourRect.bottom + gap;
            const idealLeft = tourRect.left + tourRect.width / 2 - calloutW / 2;
            const left = Math.min(Math.max(idealLeft, 12), viewportW - calloutW - 12);
            const arrowLeft = Math.min(Math.max(tourRect.left + tourRect.width / 2 - left - 6, 12), calloutW - 24);
            const isLastStep = tourStepIndex === tourSteps.length - 1;

            return (
              <div
                className="absolute p-4 border rounded-lg shadow-2xl border-cyan-400/60 bg-slate-950/95 backdrop-blur-md"
                style={{
                  top: placeAbove ? undefined : top,
                  bottom: placeAbove ? viewportH - top : undefined,
                  left,
                  width: calloutW,
                }}
              >
                <div
                  className="absolute w-3 h-3 border-cyan-400/60 bg-slate-950/95"
                  style={
                    placeAbove
                      ? { left: arrowLeft, bottom: -6, borderRight: '1px solid', borderBottom: '1px solid', transform: 'rotate(45deg)' }
                      : { left: arrowLeft, top: -6, borderLeft: '1px solid', borderTop: '1px solid', transform: 'rotate(45deg)' }
                  }
                />
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-purple-300/80">
                    Kali · Quick Start {tourStepIndex + 1}/{tourSteps.length}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-100">{tourSteps[tourStepIndex].message}</p>
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={endTour}
                    className="text-[10px] font-mono uppercase tracking-wide text-slate-500 hover:text-slate-300"
                  >
                    Skip Tour
                  </button>
                  <button
                    type="button"
                    onClick={() => (isLastStep ? endTour() : setTourStepIndex((i) => i + 1))}
                    className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide rounded bg-cyan-400 text-cyan-950 hover:bg-cyan-300"
                  >
                    {isLastStep ? 'Finish' : 'Next →'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <style jsx>{`
        @keyframes messier-pulse {
          0% { r: 5; stroke-opacity: 0.9; }
          100% { r: 11; stroke-opacity: 0; }
        }
        .animate-messier-pulse {
          animation: messier-pulse 1.1s ease-out infinite;
        }
        @keyframes target-pulse {
          0% { r: 7; stroke-opacity: 0.9; }
          100% { r: 16; stroke-opacity: 0; }
        }
        .animate-target-pulse {
          animation: target-pulse 1.4s ease-out infinite;
        }
        @keyframes azimuth-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-azimuth-sweep {
          animation: azimuth-sweep 8s linear infinite;
        }
        @keyframes glass-fade-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-glass-fade-in {
          animation: glass-fade-in 0.35s ease-out;
        }
        @keyframes tour-glow {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(2,6,16,0.8), 0 0 10px 2px rgba(103,232,249,0.5); }
          50% { box-shadow: 0 0 0 9999px rgba(2,6,16,0.8), 0 0 22px 6px rgba(103,232,249,0.9); }
        }
        .animate-tour-glow {
          animation: tour-glow 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
