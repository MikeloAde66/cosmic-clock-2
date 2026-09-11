// Real SGP4/SDP4 propagation, running off the main thread. Uses
// satellite.js (already a real dependency, and the exact same API surface
// already proven working in lib/useIssTracker.ts — propagate/gstime/
// eciToEcf/ecfToLookAngles/eciToGeodetic) rather than a hand-rolled
// propagator: SGP4/SDP4 is a precise, easy-to-get-subtly-wrong orbital
// mechanics algorithm, and satellite.js is the correct, tested,
// "production-ready" implementation to build on, the same way
// astronomy-engine is for the Equatorial/Horizon math elsewhere in this
// rewrite. Generalizes useIssTracker's single-hardcoded-ISS pattern to an
// arbitrary set of caller-supplied TLEs.
import * as satellite from 'satellite.js';

export interface TrackedTle {
  id: string;
  name: string;
  tleLine1: string;
  tleLine2: string;
}

export interface WorkerObserver {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
}

export interface SatelliteUpdate {
  id: string;
  name: string;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  velocityKmS: number;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  isVisible: boolean;
}

export type MainToWorkerMessage =
  | { type: 'setObserver'; observer: WorkerObserver }
  | { type: 'setSatellites'; satellites: TrackedTle[] };

export type WorkerToMainMessage =
  | { type: 'update'; timestampMs: number; results: SatelliteUpdate[] }
  | { type: 'error'; id: string; message: string };

const UPDATE_INTERVAL_MS = 100;

interface TrackedSatrec {
  id: string;
  name: string;
  satrec: satellite.SatRec;
}

let observer: WorkerObserver | null = null;
let tracked: TrackedSatrec[] = [];
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function propagateAll() {
  if (!observer || tracked.length === 0) return;

  const now = new Date();
  const observerGd = {
    latitude: satellite.degreesToRadians(observer.latitudeDeg),
    longitude: satellite.degreesToRadians(observer.longitudeDeg),
    height: observer.elevationMeters / 1000,
  };

  const results: SatelliteUpdate[] = [];
  for (const { id, name, satrec } of tracked) {
    try {
      const positionAndVelocity = satellite.propagate(satrec, now);
      if (!positionAndVelocity?.position || typeof positionAndVelocity.position === 'boolean') continue;
      const gmst = satellite.gstime(now);
      const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
      const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
      const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      const velocity = positionAndVelocity.velocity;
      const velocityKmS =
        typeof velocity === 'boolean' ? 0 : Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
      const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);

      results.push({
        id,
        name,
        azimuthDeg: satellite.radiansToDegrees(lookAngles.azimuth),
        elevationDeg,
        rangeKm: lookAngles.rangeSat,
        velocityKmS,
        latitudeDeg: satellite.radiansToDegrees(geodetic.latitude),
        longitudeDeg: satellite.radiansToDegrees(geodetic.longitude),
        altitudeKm: geodetic.height,
        isVisible: elevationDeg > 0,
      });
    } catch (err) {
      const message: WorkerToMainMessage = {
        type: 'error',
        id,
        message: err instanceof Error ? err.message : 'Propagation failed.',
      };
      postMessage(message);
    }
  }

  const update: WorkerToMainMessage = { type: 'update', timestampMs: now.getTime(), results };
  postMessage(update);
}

function ensureLoop() {
  if (intervalHandle !== null) return;
  intervalHandle = setInterval(propagateAll, UPDATE_INTERVAL_MS);
}

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;
  if (msg.type === 'setObserver') {
    observer = msg.observer;
    ensureLoop();
  } else if (msg.type === 'setSatellites') {
    tracked = msg.satellites.flatMap(({ id, name, tleLine1, tleLine2 }) => {
      try {
        const satrec = satellite.twoline2satrec(tleLine1.trim(), tleLine2.trim());
        return [{ id, name, satrec }];
      } catch (err) {
        const message: WorkerToMainMessage = {
          type: 'error',
          id,
          message: err instanceof Error ? err.message : 'Invalid TLE.',
        };
        postMessage(message);
        return [];
      }
    });
    ensureLoop();
  }
};
