'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useDsnTelemetry, type DsnLink } from '@/lib/useDsnTelemetry';

// Real, live links from NASA/JPL's DSN Now feed (proxied server-side by
// app/api/dsn/telemetry — see that route's own comments for the feed's
// real, verified quirks: no live carrier frequency, and light-time derived
// from the feed's real range figures rather than its own always-unpopulated
// rtlt attribute). Nothing here is estimated or simulated — a spacecraft
// not currently in this list simply isn't in active contact with any dish
// right now, shown as such rather than papered over.

function formatDataRate(bps: number | null): string {
  if (bps === null || bps <= 0) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} kbps`;
  return `${bps.toFixed(0)} bps`;
}

function formatLightTime(seconds: number | null): string {
  if (seconds === null) return 'unavailable';
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(2)} hr`;
  const minutes = seconds / 60;
  if (minutes >= 1) return `${minutes.toFixed(1)} min`;
  return `${seconds.toFixed(1)} s`;
}

function groupByStation(links: DsnLink[]): Map<string, DsnLink[]> {
  const map = new Map<string, DsnLink[]>();
  for (const link of links) {
    const key = link.stationName || link.stationCode;
    map.set(key, [...(map.get(key) ?? []), link]);
  }
  return map;
}

export default function DsnTelemetryPanel({ active }: { active: boolean }) {
  const { links, error } = useDsnTelemetry(active);

  if (error) {
    return <p className="p-3 font-mono text-xs text-rose-400">{error}</p>;
  }
  if (!links) {
    return (
      <p className="flex items-center gap-2 p-3 font-mono text-xs text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Contacting NASA DSN Now…
      </p>
    );
  }

  const byStation = groupByStation(links);

  if (links.length === 0) {
    return <p className="p-3 font-mono text-xs text-slate-500">No active spacecraft links reported right now.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">Live from NASA/JPL Deep Space Network</p>

      {Array.from(byStation.entries()).map(([station, stationLinks]) => (
        <div key={station} className="border rounded border-slate-800 bg-slate-900/40">
          <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide text-cyan-300 border-b border-slate-800/80">
            {station}
          </div>
          <div className="divide-y divide-slate-800/60">
            {stationLinks.map((link, i) => (
              <div key={`${link.dishName}-${link.direction}-${i}`} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-white">
                    {link.dishName} <span className="text-slate-500">· {link.direction === 'down' ? 'downlink' : 'uplink'}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{link.spacecraftName}</div>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-400 shrink-0">
                  <div className="text-cyan-300">
                    {link.band ?? '?'}-band · {formatDataRate(link.dataRateBps)}
                  </div>
                  <div>{link.powerDbm !== null ? `${link.powerDbm} dBm` : '—'}</div>
                  <div>one-way light-time {formatLightTime(link.oneWayLightTimeSeconds)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
