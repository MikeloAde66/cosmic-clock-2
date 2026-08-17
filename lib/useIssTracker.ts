'use client';

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
  latitude: number; // sub-satellite latitude
  longitude: number; // sub-satellite longitude
  altitudeKm: number; // sub-satellite altitude
  isVisible: boolean; // elevation > 0
  timestamp: Date;
}

export interface UseIssTrackerResult {
  telemetry: IssTelemetry | null;
  isLoading: boolean;
  error: string | null;
  refetchTle: () => Promise<void>;
}

const CELESTRAK_ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

// Real local SGP4 orbital propagation from a fetched TLE (Two-Line Element
// set), not a source of live position on its own — TLEs are a snapshot of
// a satellite's orbital elements at some epoch, accurate for a few days
// before drifting, hence refetchTle. This trades lib/satelliteTracking.ts's
// simpler approach (poll a REST API for "here's the ISS's position right
// now") for one that can interpolate position locally between fetches.
export function useIssTracker(
  observer: ObserverLocation = { latitude: 32.7765, longitude: -79.9311, altitudeKm: 0.01 },
  // 1 Hz, not 20 Hz — the ISS's apparent position (and this display's
  // 2-decimal precision) doesn't change meaningfully within 50ms, so a
  // faster interval would just burn CPU/battery on re-renders no one can
  // perceive while the modal is open.
  updateIntervalMs: number = 1000
): UseIssTrackerResult {
  const [telemetry, setTelemetry] = useState<IssTelemetry | null>(null);
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
    fetchTle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading || !satrecRef.current) return;

    const observerGd = {
      latitude: satellite.degreesToRadians(observer.latitude),
      longitude: satellite.degreesToRadians(observer.longitude),
      height: observer.altitudeKm ?? 0.01,
    };

    const tick = () => {
      const satrec = satrecRef.current;
      if (!satrec) return;

      const now = new Date();
      const positionAndVelocity = satellite.propagate(satrec, now);
      // This satellite.js version's propagate() returns
      // `PositionAndVelocity | null` — position is never a boolean here
      // (older SGP4 bindings used `false` for a decayed satellite; this
      // one doesn't), so the only real failure mode to guard is null.
      if (!positionAndVelocity?.position) return;

      const gmst = satellite.gstime(now);
      const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
      const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
      const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

      const elevation = satellite.radiansToDegrees(lookAngles.elevation);
      setTelemetry({
        azimuth: Number(satellite.radiansToDegrees(lookAngles.azimuth).toFixed(2)),
        elevation: Number(elevation.toFixed(2)),
        latitude: Number(satellite.radiansToDegrees(geodetic.latitude).toFixed(4)),
        longitude: Number(satellite.radiansToDegrees(geodetic.longitude).toFixed(4)),
        altitudeKm: Number(geodetic.height.toFixed(2)),
        isVisible: elevation > 0,
        timestamp: now,
      });
    };

    tick();
    const intervalId = window.setInterval(tick, updateIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [observer.latitude, observer.longitude, observer.altitudeKm, updateIntervalMs, isLoading]);

  return { telemetry, isLoading, error, refetchTle: fetchTle };
}
