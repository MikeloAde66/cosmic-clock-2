'use client';

import React, { useEffect, useRef, useState } from 'react';

const CESIUM_VERSION = '1.114';
const CESIUM_JS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_CSS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;
const CESIUM_SCRIPT_ID = 'cesium-js';
const CESIUM_CSS_ID = 'cesium-css';

// Loaded from the CDN (script+link tags), not the `cesium` npm package —
// npm Cesium needs its static Workers/Assets/ThirdParty/Widgets directories
// copied into public/ and a webpack config change just to resolve; the CDN
// build is a complete, self-contained bundle, which is what the original
// prototype this was built from already used. Idempotent: checks for an
// existing tag first so navigating back to this page twice doesn't load it
// twice.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCesium(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.Cesium) {
      resolve(window.Cesium);
      return;
    }
    if (!document.getElementById(CESIUM_CSS_ID)) {
      const link = document.createElement('link');
      link.id = CESIUM_CSS_ID;
      link.rel = 'stylesheet';
      link.href = CESIUM_CSS_URL;
      document.head.appendChild(link);
    }
    const existing = document.getElementById(CESIUM_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Cesium));
      existing.addEventListener('error', () => reject(new Error('Failed to load CesiumJS.')));
      return;
    }
    const script = document.createElement('script');
    script.id = CESIUM_SCRIPT_ID;
    script.src = CESIUM_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.Cesium);
    script.onerror = () => reject(new Error('Failed to load CesiumJS.'));
    document.body.appendChild(script);
  });
}

// Simple planar approximation of the WGS84 destination formula — accurate
// enough at drone speeds/altitudes (tens of meters per frame) without
// pulling in a full geodesy library. heading is radians clockwise from
// north, matching Cesium's own heading convention.
const EARTH_RADIUS_M = 6378137;
function stepPosition(lat: number, lon: number, headingRad: number, distanceM: number) {
  const dLat = (distanceM * Math.cos(headingRad)) / EARTH_RADIUS_M;
  const dLon = (distanceM * Math.sin(headingRad)) / (EARTH_RADIUS_M * Math.cos(lat));
  return { lat: lat + dLat, lon: lon + dLon };
}

const MOVE_SPEED_MPS = 25; // forward/back cruise speed
const TURN_RATE_RADPS = 1.1; // yaw rate
const CLIMB_RATE_MPS = 12;
const MIN_ALTITUDE_M = 5;
const MAX_ALTITUDE_M = 3000;
// Dead zone + gain for a Bluetooth/USB gamepad's analog sticks (left stick:
// yaw + throttle, right stick Y: climb/descend) — polled every frame via
// the Gamepad API rather than 'gamepadconnected' events, since Chrome only
// updates gamepad.axes/buttons snapshots on each requestAnimationFrame poll.
const GAMEPAD_DEADZONE = 0.15;

interface FlightState {
  lat: number; // radians
  lon: number; // radians
  heightM: number;
  headingRad: number;
}

// Recon overlay — a themed, entirely client-side visualization, same spirit
// as the rest of this app's "Kali" flavor text (QUANTUM SYNC, AKASHIC LINK,
// etc. elsewhere are decorative, not real telemetry). Targets are randomly
// generated near the drone's own position; nothing here looks up, probes,
// or scans any real host, IP, or network. "ports" are a cosmetic label
// pulled from a fixed pool, not a real scan result.
type TargetStatus = 'unknown' | 'active' | 'secured';
interface ReconTarget {
  id: string;
  lat: number; // radians
  lon: number; // radians
  heightM: number;
  label: string;
  status: TargetStatus;
  ports: number[];
}
const MOCK_PORT_POOL = [21, 22, 23, 25, 53, 80, 443, 3306, 3389, 5432, 8080, 8443, 27017];
const STATUS_POOL: TargetStatus[] = ['unknown', 'active', 'secured'];
// No amber/gold anywhere in this app by standing design rule (see
// KaliOracleView's own comment on the same constraint) — cyan/white/rose/
// emerald only.
const STATUS_COLOR: Record<TargetStatus, string> = {
  unknown: '#94a3b8',
  active: '#fb7185',
  secured: '#34d399',
};
const ORBIT_RANGE_M = 180;
const ORBIT_PITCH_RAD = -0.5; // ~-30°, looking down at the target
const ORBIT_RATE_RADPS = 0.45;

interface TargetTelemetry {
  label: string;
  status: TargetStatus;
  ports: number[];
  distanceM: number;
}

function randomPorts(): number[] {
  const count = 2 + Math.floor(Math.random() * 3); // 2-4
  const pool = [...MOCK_PORT_POOL];
  const picked: number[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

// Same simple-sphere approximation as stepPosition above — fine at the
// multi-hundred-to-few-thousand-meter ranges targets are scattered within.
function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export default function DroneSimulator() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Cesium itself is loaded at runtime from the CDN (see loadCesium above),
  // not the npm package, so there are no real type definitions for it here
  // — `any` is the honest type for these, not a shortcut around real ones.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const droneEntityRef = useRef<any>(null);
  const flightRef = useRef<FlightState>({
    lat: Cesium_toRadians(40.7128),
    lon: Cesium_toRadians(-74.006),
    heightM: 150,
    headingRad: Cesium_toRadians(90),
  });
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const trackingRef = useRef(true);

  // Recon overlay state — targetsRef is the source of truth (read/written
  // from command handlers and the per-frame tick loop alike), mirroring the
  // same ref-for-continuously-read-data / state-for-rendering split the
  // flight controls above already use. targetEntitiesRef tracks the actual
  // Cesium point+label entities so they can be removed on "clear"/unmount.
  const targetsRef = useRef<ReconTarget[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetEntitiesRef = useRef<Map<string, any>>(new Map());
  const trackedTargetIdRef = useRef<string | null>(null);
  const orbitHeadingRef = useRef(0);
  const logIdRef = useRef(0);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [hud, setHud] = useState<{
    altitude: number;
    heading: number;
    speed: number;
    tracking: boolean;
    targetCount: number;
    trackedTarget: TargetTelemetry | null;
  }>({ altitude: 150, heading: 90, speed: 0, tracking: true, targetCount: 0, trackedTarget: null });
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandLog, setCommandLog] = useState<{ id: number; text: string }[]>([]);

  const pushLog = (text: string) => {
    logIdRef.current += 1;
    // Capture the id now, not inside the updater below — pushLog is often
    // called twice back-to-back (the '> command' echo, then its response),
    // and setCommandLog's updater queue only runs once React processes the
    // batch; reading logIdRef.current lazily inside it would have both
    // updaters see whatever the ref had become by then, handing out the
    // same id twice (confirmed: this was really happening, not just a
    // hypothetical — "two children with the same key" in the console).
    const id = logIdRef.current;
    setCommandLog((prev) => [...prev.slice(-6), { id, text }]);
  };

  // Scatters `count` mock targets at random bearings/distances (300m-2km)
  // from the drone's current position — see the ReconTarget/TargetStatus
  // comment above on why this is simulated, not a real scan.
  const addMockTargets = (count: number) => {
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    const f = flightRef.current;
    const created: ReconTarget[] = [];
    for (let i = 0; i < count; i++) {
      const bearing = Math.random() * Math.PI * 2;
      const distance = 300 + Math.random() * 1700;
      const { lat, lon } = stepPosition(f.lat, f.lon, bearing, distance);
      const status = STATUS_POOL[Math.floor(Math.random() * STATUS_POOL.length)];
      const target: ReconTarget = {
        id: `target-${Date.now()}-${i}`,
        lat,
        lon,
        heightM: f.heightM,
        label: `NODE-${Math.floor(1000 + Math.random() * 9000)}`,
        status,
        ports: randomPorts(),
      };
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromRadians(lon, lat, f.heightM),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString(STATUS_COLOR[status]),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
        },
        label: {
          text: `${target.label} [${status.toUpperCase()}]`,
          font: '12px monospace',
          fillColor: Cesium.Color.WHITE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.65)'),
        },
      });
      targetEntitiesRef.current.set(target.id, entity);
      created.push(target);
    }
    targetsRef.current = [...targetsRef.current, ...created];
  };

  const clearTargets = () => {
    const viewer = viewerRef.current;
    targetEntitiesRef.current.forEach((entity) => viewer?.entities.remove(entity));
    targetEntitiesRef.current.clear();
    targetsRef.current = [];
    if (trackedTargetIdRef.current) disengageTargetTracking();
  };

  const findNearestTarget = (): { target: ReconTarget; distanceM: number } | null => {
    const f = flightRef.current;
    const targets = targetsRef.current;
    if (targets.length === 0) return null;
    let nearest = targets[0];
    let nearestDist = haversineDistanceM(f.lat, f.lon, nearest.lat, nearest.lon);
    for (const t of targets.slice(1)) {
      const d = haversineDistanceM(f.lat, f.lon, t.lat, t.lon);
      if (d < nearestDist) {
        nearest = t;
        nearestDist = d;
      }
    }
    return { target: nearest, distanceM: nearestDist };
  };

  // 'T' toggles; the command bar's "fly to"/"track" phrasing always engages
  // (never toggles off) so typing it twice doesn't accidentally disengage.
  const engageTargetTracking = (): string => {
    const nearest = findNearestTarget();
    if (!nearest) return 'No recon targets detected yet — try "scan area" first.';
    trackedTargetIdRef.current = nearest.target.id;
    orbitHeadingRef.current = 0;
    if (viewerRef.current) viewerRef.current.trackedEntity = undefined;
    return `Orbiting target ${nearest.target.label}.`;
  };

  const disengageTargetTracking = (): string => {
    trackedTargetIdRef.current = null;
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (viewer && Cesium) viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    if (viewer && trackingRef.current && droneEntityRef.current) viewer.trackedEntity = droneEntityRef.current;
    return 'Target tracking disengaged — chase-cam resumed.';
  };

  const toggleTargetTracking = (): string =>
    trackedTargetIdRef.current ? disengageTargetTracking() : engageTargetTracking();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = commandInput.trim();
    if (!raw) return;
    pushLog(`> ${raw}`);
    setCommandInput('');

    const lower = raw.toLowerCase();
    if (/clear|reset/.test(lower)) {
      clearTargets();
      pushLog('Recon targets cleared.');
      return;
    }
    if (/scan|locate|detect|find/.test(lower)) {
      const count = 3 + Math.floor(Math.random() * 3);
      addMockTargets(count);
      pushLog(`Scan complete — ${count} target${count === 1 ? '' : 's'} detected nearby. (simulated)`);
      return;
    }
    if (/stop|disengage|cancel/.test(lower)) {
      pushLog(disengageTargetTracking());
      return;
    }
    if (/fly to|go to|track|navigate|orbit/.test(lower)) {
      pushLog(engageTargetTracking());
      return;
    }
    pushLog('Command not recognized. Try "scan area" or "fly to nearest target".');
  };

  useEffect(() => {
    let cancelled = false;

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !containerRef.current) return;

        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken;
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          // Real terrain needs a Cesium Ion token (NEXT_PUBLIC_CESIUM_ION_TOKEN) —
          // without one, fall back to a token-free smooth ellipsoid globe
          // rather than letting Cesium throw on an unauthenticated terrain
          // request.
          terrainProvider: ionToken ? undefined : new Cesium.EllipsoidTerrainProvider(),
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
        });
        viewerRef.current = viewer;

        if (ionToken) {
          if (Cesium.createWorldTerrainAsync) {
            Cesium.createWorldTerrainAsync().then((tp: unknown) => {
              if (!cancelled) viewer.terrainProvider = tp;
            });
          } else {
            viewer.terrainProvider = Cesium.createWorldTerrain();
          }
        }

        const f = flightRef.current;
        const position = Cesium.Cartesian3.fromRadians(f.lon, f.lat, f.heightM);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          new Cesium.HeadingPitchRoll(f.headingRad, 0, 0)
        );

        const droneEntity = viewer.entities.add({
          name: 'AiOne-Virtual-Drone',
          position,
          orientation,
          model: {
            uri: 'https://cesium.com/content/CesiumDrone/CesiumDrone.gltf',
            minimumPixelSize: 64,
            maximumScale: 200,
          },
        });
        droneEntityRef.current = droneEntity;
        viewer.trackedEntity = droneEntity;

        setStatus('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Keyboard flight controls — WASD/arrows to move+turn, R/F (or Space/Shift)
  // to climb/descend, C to toggle chase-cam tracking. Listens on window
  // rather than the Cesium container so focus doesn't need to be inside it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing in the recon command bar shouldn't also fly the drone —
      // every keystroke there would otherwise land in keysRef too.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        trackingRef.current = !trackingRef.current;
        if (viewerRef.current && droneEntityRef.current && !trackedTargetIdRef.current) {
          viewerRef.current.trackedEntity = trackingRef.current ? droneEntityRef.current : undefined;
        }
        return;
      }
      if (key === 't') {
        pushLog(toggleTargetTracking());
        return;
      }
      keysRef.current.add(key);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // toggleTargetTracking is intentionally omitted — like trackingRef/
    // droneEntityRef above, it only ever touches refs and stable setState
    // dispatchers internally, so this listener never goes stale even though
    // the attach/detach itself only needs to happen once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main flight loop — recomputes the drone's lat/lon/height/heading every
  // frame from whichever input (keyboard or a connected gamepad) is active,
  // then writes the result straight onto the entity's position/orientation.
  // requestAnimationFrame (not Cesium's own clock.onTick) since none of this
  // depends on simulated time, just real elapsed wall-clock time.
  useEffect(() => {
    if (status !== 'ready') return;
    const CesiumNS = window.Cesium;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
        return;
      }
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.1); // clamp to survive tab-throttling
      lastTickRef.current = now;

      const keys = keysRef.current;
      let turnInput = 0; // -1..1, positive = turn right
      let throttleInput = 0; // -1..1, positive = forward
      let climbInput = 0; // -1..1, positive = up

      if (keys.has('a') || keys.has('arrowleft')) turnInput -= 1;
      if (keys.has('d') || keys.has('arrowright')) turnInput += 1;
      if (keys.has('w') || keys.has('arrowup')) throttleInput += 1;
      if (keys.has('s') || keys.has('arrowdown')) throttleInput -= 1;
      if (keys.has('r') || keys.has(' ')) climbInput += 1;
      if (keys.has('f') || keys.has('shift')) climbInput -= 1;

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = gamepads[0];
      if (pad) {
        const [lx, ly, , ry] = pad.axes;
        if (Math.abs(lx) > GAMEPAD_DEADZONE) turnInput = lx;
        if (Math.abs(ly) > GAMEPAD_DEADZONE) throttleInput = -ly; // sticks report "up" as negative
        if (typeof ry === 'number' && Math.abs(ry) > GAMEPAD_DEADZONE) climbInput = -ry;
      }
      setGamepadConnected(!!pad);

      const f = flightRef.current;
      f.headingRad += turnInput * TURN_RATE_RADPS * dt;
      const { lat, lon } = stepPosition(f.lat, f.lon, f.headingRad, throttleInput * MOVE_SPEED_MPS * dt);
      f.lat = lat;
      f.lon = lon;
      f.heightM = Math.min(MAX_ALTITUDE_M, Math.max(MIN_ALTITUDE_M, f.heightM + climbInput * CLIMB_RATE_MPS * dt));

      const position = CesiumNS.Cartesian3.fromRadians(f.lon, f.lat, f.heightM);
      const orientation = CesiumNS.Transforms.headingPitchRollQuaternion(
        position,
        new CesiumNS.HeadingPitchRoll(f.headingRad, 0, 0)
      );
      const entity = droneEntityRef.current;
      if (entity) {
        entity.position = new CesiumNS.ConstantPositionProperty(position);
        entity.orientation = new CesiumNS.ConstantProperty(orientation);
      }

      // Target-tracking mode ('T' or the command bar's "fly to") takes over
      // the camera with a continuous orbit around whichever target engaged
      // it, overriding the drone's own chase-cam until disengaged.
      let trackedTelemetry: TargetTelemetry | null = null;
      const targetId = trackedTargetIdRef.current;
      if (targetId) {
        const target = targetsRef.current.find((t) => t.id === targetId);
        if (target) {
          orbitHeadingRef.current += ORBIT_RATE_RADPS * dt;
          const center = CesiumNS.Cartesian3.fromRadians(target.lon, target.lat, target.heightM);
          viewerRef.current.camera.lookAt(
            center,
            new CesiumNS.HeadingPitchRange(orbitHeadingRef.current, ORBIT_PITCH_RAD, ORBIT_RANGE_M)
          );
          trackedTelemetry = {
            label: target.label,
            status: target.status,
            ports: target.ports,
            distanceM: Math.round(haversineDistanceM(f.lat, f.lon, target.lat, target.lon)),
          };
        } else {
          // Target was cleared out from under an active orbit — disengage
          // defensively rather than orbiting a now-nonexistent point.
          trackedTargetIdRef.current = null;
        }
      }

      setHud({
        altitude: Math.round(f.heightM),
        heading: Math.round((CesiumNS.Math.toDegrees(f.headingRad) + 360) % 360),
        speed: Math.round(Math.abs(throttleInput) * MOVE_SPEED_MPS),
        tracking: trackingRef.current,
        targetCount: targetsRef.current.length,
        trackedTarget: trackedTelemetry,
      });
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [status]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-sm text-slate-400 bg-black">
          Loading globe…
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-6 font-mono text-sm text-center text-rose-400 bg-black">
          Couldn&apos;t load CesiumJS: {errorMessage}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div
            className="absolute z-10 px-4 py-3 font-mono text-xs border rounded-lg pointer-events-none top-4 left-4 border-cyan-500/30"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#00ffcc' }}
          >
            <p className="mb-1 text-sm font-bold">AiOne Virtual Drone HUD</p>
            <p>Altitude: {hud.altitude} m</p>
            <p>Heading: {hud.heading}°</p>
            <p>Speed: {hud.speed} m/s</p>
            <p>
              Camera: {hud.trackedTarget ? 'Orbit' : hud.tracking ? 'Chase-Cam' : 'Free'}{' '}
              {gamepadConnected && '· Gamepad connected'}
            </p>

            {/* Recon telemetry — see the ReconTarget/addMockTargets comments
                above: simulated data only, nothing here is a real scan. */}
            {hud.trackedTarget ? (
              <div className="pt-2 mt-2 border-t border-cyan-500/20">
                <p className="font-bold" style={{ color: STATUS_COLOR[hud.trackedTarget.status] }}>
                  TARGET {hud.trackedTarget.label} [{hud.trackedTarget.status.toUpperCase()}]
                </p>
                <p>Distance: {hud.trackedTarget.distanceM} m</p>
                <p>Scan ports: {hud.trackedTarget.ports.join(', ')}</p>
              </div>
            ) : hud.targetCount > 0 ? (
              <p className="pt-2 mt-2 border-t border-cyan-500/20">{hud.targetCount} recon target(s) detected</p>
            ) : null}

            <p className="mt-2 text-cyan-300/70">
              WASD/Arrows to fly · R/F or Space/Shift to climb · C to toggle camera · T to track nearest target
            </p>
          </div>

          {/* Recon command bar — a local keyword parser (see
              handleCommandSubmit above), not a real backend call. "Live"
              OSINT/scanning integration is explicitly out of scope; this is
              a themed visualization only. */}
          <div className="absolute z-10 -translate-x-1/2 bottom-4 left-1/2 w-[min(90vw,32rem)]">
            {commandLog.length > 0 && (
              <div
                className="px-3 py-2 mb-2 overflow-y-auto font-mono text-xs border rounded-lg max-h-28 border-cyan-500/30"
                style={{ background: 'rgba(0,0,0,0.75)', color: '#00ffcc' }}
              >
                {commandLog.map((entry) => (
                  <p key={entry.id} className="leading-relaxed">
                    {entry.text}
                  </p>
                ))}
              </div>
            )}
            <form onSubmit={handleCommandSubmit} className="flex gap-2">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder='Try "scan area" or "fly to nearest target"'
                className="flex-1 px-3 py-2 font-mono text-xs text-white border rounded-lg outline-none border-cyan-500/30 placeholder:text-slate-500 focus:border-cyan-400/60"
                style={{ background: 'rgba(0,0,0,0.75)' }}
              />
              <button
                type="submit"
                className="px-4 py-2 font-mono text-xs font-bold text-black transition bg-cyan-400 rounded-lg hover:bg-cyan-300"
              >
                SEND
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

// Tiny helper so flightRef's initializer doesn't need Cesium loaded yet
// (it runs at module/component init time, before the async load resolves).
function Cesium_toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

declare global {
  interface Window {
    // No real type definitions — see loadCesium's own comment on why this
    // is loaded from the CDN rather than the npm package.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cesium: any;
  }
}
