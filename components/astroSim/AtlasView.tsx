'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import ModeBadge from '@/components/astroSim/ModeBadge';
import { ATLAS_WORLDS } from '@/lib/astroSim/atlasWorlds';
import { formatLat, formatLon } from '@/lib/astroSim/coords';
import { LUNAR_TARGETS } from '@/lib/astroSim/lunar';
import type { AtlasMarker } from './AtlasMap';

const AtlasMap = dynamic(() => import('./AtlasMap'), { ssr: false });

// Only features checked against the IAU/USGS Gazetteer get a marker.
const MOON_FEATURES = LUNAR_TARGETS.filter((t) => t.status === 'VERIFIED');
const MOON_MARKERS: AtlasMarker[] = MOON_FEATURES.map((t) => ({ id: t.name, name: t.name, latDeg: t.latDeg, lonDeg: t.lonDeg }));
const NO_MARKERS: AtlasMarker[] = [];

export default function AtlasView() {
  const [worldId, setWorldId] = useState<'moon' | 'mars'>('moon');
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const world = ATLAS_WORLDS.find((w) => w.id === worldId)!;
  const markers = worldId === 'moon' ? MOON_MARKERS : NO_MARKERS;
  const feature = useMemo(() => (worldId === 'moon' ? MOON_FEATURES.find((t) => t.name === selected) ?? null : null), [worldId, selected]);

  return (
    <div className="flex flex-col flex-1 min-h-0 lg:flex-row">
      <div className="relative flex-1 min-h-[45vh]">
        <AtlasMap key={worldId} world={world} markers={markers} focus={focus} onSelect={setSelected} />
        <div className="absolute z-[500] flex flex-col gap-2 top-3 left-3">
          <div className="flex gap-2">
            {ATLAS_WORLDS.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWorldId(w.id);
                  setSelected(null);
                  setFocus(null);
                }}
                aria-pressed={w.id === worldId}
                className={`h-8 px-4 text-[11px] uppercase tracking-[0.2em] rounded border backdrop-blur ${w.id === worldId ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-slate-600 bg-slate-950/70 text-slate-300 hover:text-white'}`}
              >
                {w.name}
              </button>
            ))}
          </div>
          <ModeBadge mode="ENHANCED" note="Real NASA imagery from Solar System Treks, shown as a map" />
        </div>
      </div>

      <aside className="flex flex-col w-full min-h-0 overflow-y-auto border-t lg:w-96 lg:border-t-0 lg:border-l border-slate-800 bg-[#07090E]">
        {feature ? (
          <section className="p-4 border-b border-slate-800">
            <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">Selected feature</p>
            <p className="mt-1 text-lg font-bold text-amber-300">{feature.name}</p>
            <p className="text-[11px] uppercase text-slate-400">{feature.type}</p>
            <dl className="grid grid-cols-2 mt-3 text-[11px] gap-y-1.5 tabular-nums">
              <dt className="text-slate-500">Lat</dt>
              <dd className="text-right">{formatLat(feature.latDeg)}</dd>
              <dt className="text-slate-500">Lon</dt>
              <dd className="text-right">{formatLon(feature.lonDeg)}</dd>
              <dt className="text-slate-500">Diameter</dt>
              <dd className="text-right">{feature.diameterKm != null ? `${feature.diameterKm} km` : '—'}</dd>
              <dt className="text-slate-500">Depth</dt>
              <dd className="text-right">{feature.depthKm != null ? `~${feature.depthKm} km` : '—'}</dd>
            </dl>
            <p className="mt-3 text-[10px] leading-snug text-emerald-300/90">
              Verified: IAU/USGS Gazetteer.{' '}
              {feature.source && (
                <a href={feature.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-200">
                  Record
                </a>
              )}
              {feature.depthKm != null && ' Depth is approximate, from NASA LOLA elevation data.'}
            </p>
          </section>
        ) : (
          <section className="p-4 border-b border-slate-800">
            <p className="text-xs leading-relaxed text-slate-400">
              {worldId === 'moon'
                ? 'Scroll or pinch to zoom, drag to pan. Click an amber marker for a verified feature.'
                : 'Scroll or pinch to zoom, drag to pan. Named-feature markers for Mars are not added yet.'}
            </p>
          </section>
        )}

        <section className="p-4 border-b border-slate-800">
          <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">{world.name} facts</p>
          <dl className="mt-3 text-[11px]">
            {world.facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-900">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="text-right text-slate-100 tabular-nums">
                  {f.value} <span className="text-slate-500">{f.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[10px] leading-snug text-slate-500">
            Source:{' '}
            <a href={world.factsSource} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
              NASA NSSDC Planetary Fact Sheet
            </a>
            {world.factsUpdated && `, page last updated ${world.factsUpdated}`}.
          </p>
        </section>

        {worldId === 'moon' && (
          <section className="flex-1 min-h-0">
            <p className="px-4 pt-3 pb-1 text-[10px] tracking-[0.25em] uppercase text-slate-500">Verified features ({MOON_FEATURES.length})</p>
            <ul>
              {MOON_FEATURES.map((t) => (
                <li key={t.name}>
                  <button
                    onClick={() => {
                      setSelected(t.name);
                      setFocus({ id: t.name, n: Date.now() });
                    }}
                    className={`flex items-baseline justify-between w-full gap-2 px-4 py-1.5 text-left text-xs hover:bg-white/5 ${t.name === selected ? 'text-amber-300' : 'text-slate-200'}`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-[10px] uppercase text-slate-600 shrink-0">{t.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
