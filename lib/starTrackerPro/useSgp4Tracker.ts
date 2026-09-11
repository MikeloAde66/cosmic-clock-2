'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeodeticLocation } from './coordinates';
import type { MainToWorkerMessage, SatelliteUpdate, TrackedTle, WorkerToMainMessage } from '@/workers/sgp4Worker';

export type { TrackedTle, SatelliteUpdate };

// Real off-main-thread SGP4/SDP4 propagation (see workers/sgp4Worker.ts)
// for an arbitrary, caller-supplied set of TLEs, updated at the worker's
// own 100ms cadence. React only re-renders when a new batch of real
// results arrives — the propagation loop itself runs entirely in the
// worker regardless of whether this component is even mounted to receive
// it, so it doesn't compete with the main thread's WebGL frame budget.
export function useSgp4Tracker(satellites: TrackedTle[], location: GeodeticLocation | null) {
  const [positions, setPositions] = useState<Record<string, SatelliteUpdate>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/sgp4Worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const msg = event.data;
      if (msg.type === 'update') {
        setPositions(Object.fromEntries(msg.results.map((r) => [r.id, r])));
      } else if (msg.type === 'error') {
        setErrors((prev) => ({ ...prev, [msg.id]: msg.message }));
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!location) return;
    const msg: MainToWorkerMessage = {
      type: 'setObserver',
      observer: {
        latitudeDeg: location.latitudeDeg,
        longitudeDeg: location.longitudeDeg,
        elevationMeters: location.elevationMeters,
      },
    };
    workerRef.current?.postMessage(msg);
  }, [location]);

  useEffect(() => {
    const msg: MainToWorkerMessage = { type: 'setSatellites', satellites };
    workerRef.current?.postMessage(msg);
    setErrors({});
  }, [satellites]);

  return { positions, errors };
}
