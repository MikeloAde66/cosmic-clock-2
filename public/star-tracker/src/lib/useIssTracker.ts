
import { useEffect, useRef, useState } from 'react';
import * as satellite from 'satellite.js';

export interface ObserverLocation {
  latitude: number; // decimal degrees
  longitude: number; // decimal degrees
  altitudeKm?: number; // altitude above sea level, km
}

export interface IssTelemetry {
  azimuth: number; // degrees, 0-360
  elevation: number; // degrees, -90 to +90
  rangeKm: number; // observer-to-satellite slant range
  latitude: number; // sub-satellite latitude
  longitude: number; // sub-satellite longitude
  altitudeKm: number; // sub-satellite altitude
  velocityKmS: number; // orbital speed, magnitude of the ECI velocity vector
  isVisible: boolean; // elevation > 0
  timestamp: Date;
}

// A short predicted sky path around "now" — propagated from the same TLE,
// not a separate data source. minutesFromNow is signed (negative = recent
// past, positive = near future) so a renderer can style the trailing vs.
// leading half of the track differently if it wants to.
export interface IssTrajectoryPoint {
  azimuth: number;
  elevation: number;
  minutesFromNow: number;
}

export interface UseIssTrackerResult {
  telemetry: IssTelemetry | null;
  trajectory: IssTrajectoryPoint[];
  isLoading: boolean;
  error: string | null;
  refetchTle: () => Promise<void>;
}

const CELESTRAK_ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
// TLE orbital elements drift out of accuracy over time (typically good to
// within a few km for a few days) — refreshing every 6h keeps propagation
// anchored to a recent epoch without hammering CelesTrak.
const TLE_REFRESH_MS = 6 * 60 * 60 * 1000;
// ±10 minutes at 1-minute steps — enough to draw a visible short arc across
// the sky dome without the cost of propagating a long ground track.
const TRAJECTORY_OFFSETS_MIN = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10];

// Real local SGP4 orbital propagation from a fetched TLE (Two-Line Element
// set), not a source of live position on its own — TLEs are a snapshot of
// a satellite's orbital elements at some epoch, accurate for a few days
// before drifting, hence the periodic refetch. This trades
// lib/satelliteTracking.ts's simpler approach (poll a REST API for "here's
// the ISS's position right now") for one that can interpolate position
// locally between fetches, predict a short forward/backward track, and
// expose orbital velocity — none of which a live-position-only REST poll
// can give you.
export function useIssTracker(
  observer: ObserverLocation = { latitude: 32.7765, longitude: -79.9311, altitudeKm: 0.01 },
  // 1 Hz, not 20 Hz — the ISS's apparent position (and this display's
  // 2-decimal precision) doesn't change meaningfully within 50ms, so a
  // faster interval would just burn CPU/battery on re-renders no one can
  // perceive while the modal is open.
  updateIntervalMs: number = 1000,
  // False lets a caller (e.g. StarTrackerView's ISS toggle) mount this hook
  // unconditionally while still not hitting CelesTrak or running SGP4 until
  // the feature is actually turned on.
  enabled: boolean = true
): UseIssTrackerResult {
  const [telemetry, setTelemetry] = useState<IssTelemetry | null>(null);
  const [trajectory, setTrajectory] = useState<IssTrajectoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const satrecRef = useRef<satellite.SatRec | null>(null);

  const fetchTle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(CELESTRAK_ISS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch TLE data: ${response.statusText}`);
      }
      const text = await response.text();
      const lines = text.trim().split('\n');
      if (lines.length < 3) {
        throw new Error('Invalid TLE response format.');
      }
      satrecRef.current = satellite.twoline2satrec(lines[1].trim(), lines[2].trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error initializing ISS tracker');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchTle();
    const refreshId = window.setInterval(fetchTle, TLE_REFRESH_MS);
    return () => window.clearInterval(refreshId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isLoading || !satrecRef.current) return;

    const observerGd = {
      latitude: satellite.degreesToRadians(observer.latitude),
      longitude: satellite.degreesToRadians(observer.longitude),
      height: observer.altitudeKm ?? 0.01,
    };

    const lookAnglesAt = (at: Date) => {
      const satrec = satrecRef.current;
      if (!satrec) return null;
      const positionAndVelocity = satellite.propagate(satrec, at);
      if (!positionAndVelocity?.position) return null;
      const gmst = satellite.gstime(at);
      const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
      return {
        lookAngles: satellite.ecfToLookAngles(observerGd, positionEcf),
        positionAndVelocity,
        gmst,
      };
    };

    const tick = () => {
      const now = new Date();
      const result = lookAnglesAt(now);
      if (!result) return;
      const { lookAngles, positionAndVelocity, gmst } = result;
      const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      const { x: vx, y: vy, z: vz } = positionAndVelocity.velocity;
      const velocityKmS = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);

      const elevation = satellite.radiansToDegrees(lookAngles.elevation);
      setTelemetry({
        azimuth: Number(satellite.radiansToDegrees(lookAngles.azimuth).toFixed(2)),
        elevation: Number(elevation.toFixed(2)),
        rangeKm: Number(lookAngles.rangeSat.toFixed(1)),
        latitude: Number(satellite.radiansToDegrees(geodetic.latitude).toFixed(4)),
        longitude: Number(satellite.radiansToDegrees(geodetic.longitude).toFixed(4)),
        altitudeKm: Number(geodetic.height.toFixed(2)),
        velocityKmS: Number(velocityKmS.toFixed(2)),
        isVisible: elevation > 0,
        timestamp: now,
      });

      const points: IssTrajectoryPoint[] = [];
      for (const minutesFromNow of TRAJECTORY_OFFSETS_MIN) {
        const offsetResult = lookAnglesAt(new Date(now.getTime() + minutesFromNow * 60_000));
        if (!offsetResult) continue;
        points.push({
          azimuth: satellite.radiansToDegrees(offsetResult.lookAngles.azimuth),
          elevation: satellite.radiansToDegrees(offsetResult.lookAngles.elevation),
          minutesFromNow,
        });
      }
      setTrajectory(points);
    };

    tick();
    const intervalId = window.setInterval(tick, updateIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [observer.latitude, observer.longitude, observer.altitudeKm, updateIntervalMs, isLoading, enabled]);

  return { telemetry, trajectory, isLoading, error, refetchTle: fetchTle };
}
