'use client';

import { useEffect, useState } from 'react';
import type { DsnLink } from '@/app/api/dsn/telemetry/route';

export type { DsnLink };

const POLL_MS = 15000; // NASA's own feed refreshes roughly every 5s server-side; no need to hammer it faster than this

// Polls our own /api/dsn/telemetry proxy (real NASA/JPL DSN Now data — see
// that route's own comments for the feed's real, verified quirks: no live
// carrier frequency, light-time derived from real range figures rather than
// the feed's own always-unpopulated rtlt). `active` gates the poll entirely
// so this doesn't run in the background for visitors who never open the DSN
// Telemetry tab.
export function useDsnTelemetry(active: boolean) {
  const [links, setLinks] = useState<DsnLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setLinks(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const poll = () => {
      fetch('/api/dsn/telemetry')
        .then((res) => {
          if (!res.ok) throw new Error('DSN feed unavailable.');
          return res.json();
        })
        .then((data: { links: DsnLink[] }) => {
          if (cancelled) return;
          setLinks(data.links);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError('DSN telemetry unavailable right now.');
        });
    };
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active]);

  return { links, error };
}
