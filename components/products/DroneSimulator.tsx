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

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [hud, setHud] = useState({ altitude: 150, heading: 90, speed: 0, tracking: true });
  const [gamepadConnected, setGamepadConnected] = useState(false);

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
      const key = e.key.toLowerCase();
      if (key === 'c') {
        trackingRef.current = !trackingRef.current;
        if (viewerRef.current && droneEntityRef.current) {
          viewerRef.current.trackedEntity = trackingRef.current ? droneEntityRef.current : undefined;
        }
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

      setHud({
        altitude: Math.round(f.heightM),
        heading: Math.round((CesiumNS.Math.toDegrees(f.headingRad) + 360) % 360),
        speed: Math.round(Math.abs(throttleInput) * MOVE_SPEED_MPS),
        tracking: trackingRef.current,
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
        <div
          className="absolute z-10 px-4 py-3 font-mono text-xs border rounded-lg pointer-events-none top-4 left-4 border-cyan-500/30"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#00ffcc' }}
        >
          <p className="mb-1 text-sm font-bold">AiOne Virtual Drone HUD</p>
          <p>Altitude: {hud.altitude} m</p>
          <p>Heading: {hud.heading}°</p>
          <p>Speed: {hud.speed} m/s</p>
          <p>
            Camera: {hud.tracking ? 'Chase-Cam' : 'Free'} {gamepadConnected && '· Gamepad connected'}
          </p>
          <p className="mt-2 text-cyan-300/70">WASD/Arrows to fly · R/F or Space/Shift to climb · C to toggle camera</p>
        </div>
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
