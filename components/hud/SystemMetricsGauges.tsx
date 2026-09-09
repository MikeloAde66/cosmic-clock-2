'use client';

import React from 'react';

// Not yet wired into any view — there's no existing WebSocket connection to
// a microservice anywhere in StarTrackerView.tsx for this to honestly
// report on (kali-quantum-service, the default serviceUrl label, is a
// request/response HTTP API used only by Kali's chat tool-use, not a
// persistent WS stream; star-tracker-pro-core has a real WS but is a
// separate, unrelated deployed project). All quantitative props are
// number | null with no fabricated defaults, same discipline as
// TelemetryGauges — a caller must pass a real value or explicit null.
export interface SystemMetricsProps {
  latencyMs: number | null; // Round-trip latency to microservice in ms
  wsConnected: boolean; // WebSocket active connection state
  sessionDurationSec: number | null; // Total elapsed session runtime in seconds
  serviceUrl?: string; // Optional microservice endpoint indicator (a label, not a measurement)
}

export const SystemMetricsGauges: React.FC<SystemMetricsProps> = ({
  latencyMs,
  wsConnected,
  sessionDurationSec,
  serviceUrl = 'kali-quantum-service',
}) => {
  // Format elapsed time into HH:MM:SS
  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '--:--:--';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs]
      .map((v) => v.toString().padStart(2, '0'))
      .join(':');
  };

  // Determine status color based on latency threshold
  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return 'text-slate-500';
    if (latency < 150) return 'text-emerald-400';
    if (latency < 350) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-cyan-400 font-mono mt-4">

      {/* 1. MICROSERVICE LATENCY METER */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center text-xs tracking-wider text-slate-400">
          <span>MICROSERVICE LATENCY</span>
          <span className={`font-bold ${getLatencyColor(latencyMs)}`}>
            {latencyMs !== null ? `${latencyMs} ms` : 'AWAITING DATA'}
          </span>
        </div>

        <div className="my-auto py-2">
          {/* Latency Scale Visualizer */}
          <div className="relative w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                latencyMs === null
                  ? 'w-0'
                  : latencyMs < 150
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                  : latencyMs < 350
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`}
              style={{
                width: latencyMs !== null ? `${Math.min(100, (latencyMs / 500) * 100)}%` : '0%',
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0ms</span>
            <span>250ms</span>
            <span>500ms+</span>
          </div>
        </div>

        <div className="text-[11px] border-t border-slate-800 pt-2 flex justify-between text-slate-400">
          <span>ENDPOINT:</span>
          <span className="text-slate-300 font-medium truncate max-w-[140px]">{serviceUrl}</span>
        </div>
      </div>

      {/* 2. WEBSOCKET SIGNAL HEALTH */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center text-xs tracking-wider text-slate-400">
          <span>SIGNAL STABILITY</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
              wsConnected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="my-auto py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs text-slate-300">
              {wsConnected ? 'LIVE STREAM ACTIVE' : 'NO TELEMETRY STREAM'}
            </span>
          </div>
        </div>

        <div className="text-[11px] border-t border-slate-800 pt-2 flex justify-between text-slate-400">
          <span>PROTOCOL:</span>
          <span className="text-cyan-400 font-semibold">WSS / JSON-RPC</span>
        </div>
      </div>

      {/* 3. SESSION EXECUTION TIMER */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center text-xs tracking-wider text-slate-400">
          <span>SESSION RUNTIME</span>
          <span className="text-cyan-300 font-bold">{formatTime(sessionDurationSec)}</span>
        </div>

        <div className="my-auto py-2 text-center">
          <div className="text-2xl font-bold tracking-widest text-slate-100 font-mono">
            {formatTime(sessionDurationSec)}
          </div>
        </div>

        <div className="text-[11px] border-t border-slate-800 pt-2 flex justify-between text-slate-400">
          <span>EXECUTION STATE:</span>
          <span className="text-slate-200">
            {sessionDurationSec !== null ? 'LOGGING ACTIVE' : 'IDLE'}
          </span>
        </div>
      </div>

    </div>
  );
};

export default SystemMetricsGauges;
