'use client';

import React, { useState } from 'react';
import { Radar, Satellite as SatelliteIcon, X } from 'lucide-react';
import { AlpacaTelescopeClient } from '@/lib/starTrackerPro/alpaca/alpacaClient';
import type { DiscoveredAlpacaServer, TelescopeStatus } from '@/lib/starTrackerPro/alpaca/types';

// Deliberately minimal per the Phase 1 UI brief: hidden by default behind
// one small toggle button, no permanently-visible gauge wall. Just enough
// surface to discover a real Alpaca server, connect, see real status, and
// command a real slew — everything else (tracking-rate presets, detailed
// diagnostics, etc.) is later-phase scope, not crammed in here.
export default function DeviceHub() {
  const [open, setOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [servers, setServers] = useState<DiscoveredAlpacaServer[]>([]);
  const [client, setClient] = useState<AlpacaTelescopeClient | null>(null);
  const [status, setStatus] = useState<TelescopeStatus | null>(null);
  const [error, setError] = useState('');
  const [targetRa, setTargetRa] = useState('');
  const [targetDec, setTargetDec] = useState('');

  const discover = async () => {
    setDiscovering(true);
    setError('');
    try {
      const res = await fetch('/api/alpaca/discover');
      if (!res.ok) throw new Error('Discovery request failed.');
      const data: { servers: DiscoveredAlpacaServer[] } = await res.json();
      setServers(data.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed.');
    } finally {
      setDiscovering(false);
    }
  };

  const connectTo = async (server: DiscoveredAlpacaServer) => {
    setError('');
    const next = new AlpacaTelescopeClient(server.host, server.alpacaPort);
    try {
      await next.connect();
      setClient(next);
      setStatus(await next.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed.');
    }
  };

  const refreshStatus = async () => {
    if (!client) return;
    try {
      setStatus(await client.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status poll failed.');
    }
  };

  const slew = async () => {
    if (!client) return;
    const ra = Number(targetRa);
    const dec = Number(targetDec);
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
      setError('Enter numeric RA (hours) and Dec (degrees).');
      return;
    }
    setError('');
    try {
      await client.slewToCoordinatesAsync(ra, dec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slew command failed.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Device Hub"
        className="fixed z-20 flex items-center justify-center w-11 h-11 text-cyan-300 border rounded-full bottom-6 right-6 border-cyan-500/40 bg-slate-950/80 backdrop-blur-md hover:border-cyan-400"
      >
        <SatelliteIcon className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-30 flex flex-col w-full max-w-sm p-5 space-y-4 overflow-y-auto border-l shadow-2xl border-slate-800 bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Device Hub</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={discover}
            disabled={discovering}
            className="flex items-center justify-center w-full gap-2 py-2 text-xs font-mono uppercase tracking-wide border rounded border-cyan-500/40 text-cyan-300 hover:border-cyan-400 disabled:opacity-40"
          >
            <Radar className="w-3.5 h-3.5" />
            {discovering ? 'Scanning…' : 'Scan for Alpaca devices'}
          </button>

          {servers.length > 0 && (
            <div className="space-y-1.5">
              {servers.map((s) => (
                <button
                  key={`${s.host}:${s.alpacaPort}`}
                  type="button"
                  onClick={() => connectTo(s)}
                  className="w-full px-3 py-2 font-mono text-xs text-left border rounded border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                >
                  {s.host}:{s.alpacaPort}
                </button>
              ))}
            </div>
          )}

          {error && <p className="font-mono text-xs text-rose-400">{error}</p>}

          {client && (
            <div className="pt-3 space-y-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Status</span>
                <button type="button" onClick={refreshStatus} className="text-[10px] font-mono uppercase text-cyan-400 hover:text-cyan-300">
                  Refresh
                </button>
              </div>
              {status ? (
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                  <div>RA {status.rightAscensionHours.toFixed(3)}h</div>
                  <div>Dec {status.declinationDeg.toFixed(2)}°</div>
                  <div>Az {status.azimuthDeg.toFixed(1)}°</div>
                  <div>Alt {status.altitudeDeg.toFixed(1)}°</div>
                  <div>{status.slewing ? 'Slewing…' : 'Idle'}</div>
                  <div>{status.tracking ? 'Tracking' : 'Not tracking'}</div>
                </div>
              ) : (
                <p className="font-mono text-xs text-slate-500">No status yet.</p>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Slew target</span>
                <div className="flex gap-2">
                  <input
                    value={targetRa}
                    onChange={(e) => setTargetRa(e.target.value)}
                    placeholder="RA (hours)"
                    className="w-full px-2 py-1.5 font-mono text-xs bg-slate-900/80 border border-slate-700 rounded outline-none text-slate-200"
                  />
                  <input
                    value={targetDec}
                    onChange={(e) => setTargetDec(e.target.value)}
                    placeholder="Dec (deg)"
                    className="w-full px-2 py-1.5 font-mono text-xs bg-slate-900/80 border border-slate-700 rounded outline-none text-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={slew}
                  className="w-full py-2 text-xs font-mono font-bold uppercase tracking-wide rounded bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                >
                  Slew to Coordinates
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
