'use client';

import { useEffect, useRef, useState } from 'react';

// Same URL resolution as app/(standalone)/pro-core/page.tsx's iframe embed —
// star-tracker-pro-core has no public deployment guarantee, so this stays
// consistent with the one other place in the app that already points at it.
const PRO_CORE_HTTP_URL =
  process.env.NEXT_PUBLIC_PRO_CORE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://star-tracker-pro-core.onrender.com' : 'http://localhost:4000');

function toWebSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws') + '/ws/indi';
}

// Real WebSocket connection state to star-tracker-pro-core, purely for the
// SystemMetricsGauges "Signal Stability" readout — this view has no other
// functional relationship with that service (its own telescope hardware
// link is useTelescopeConnection's direct Serial/Bluetooth connection, not
// this). `active` gates whether the socket exists at all, so it doesn't run
// in the background for the vast majority of visitors who never open the
// Sky Fest panel this feeds.
export function useProCoreConnection(active: boolean) {
  const [wsConnected, setWsConnected] = useState(false);
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!active) {
      wsRef.current?.close();
      wsRef.current = null;
      setWsConnected(false);
      setConnectedSince(null);
      return;
    }

    let cancelled = false;
    const ws = new WebSocket(toWebSocketUrl(PRO_CORE_HTTP_URL));
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setWsConnected(true);
      setConnectedSince(Date.now());
    };
    const onCloseOrError = () => {
      if (cancelled) return;
      setWsConnected(false);
      setConnectedSince(null);
    };
    ws.onclose = onCloseOrError;
    ws.onerror = onCloseOrError;

    return () => {
      cancelled = true;
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [active]);

  return { wsConnected, connectedSince };
}
