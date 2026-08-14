'use client';

import { useEffect, useState } from 'react';

export type GeolocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

export interface GeoCoords {
  lat: number;
  lon: number;
}

// Real browser Geolocation lookup, once per mount — mirrors the pattern
// already used in StarTrackerView.tsx so callers that need the user's
// actual position share the same permission/fallback behavior instead of
// each re-implementing it slightly differently.
export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('pending');
  const [coords, setCoords] = useState<GeoCoords | null>(null);

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
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return { status, coords };
}
