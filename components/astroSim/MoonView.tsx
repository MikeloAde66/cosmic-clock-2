'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid3x3, Search, Volume2, VolumeX } from 'lucide-react';
import type * as THREE from 'three';
import ModeBadge from '@/components/astroSim/ModeBadge';
import { formatLat, formatLon, moonLibration } from '@/lib/astroSim/coords';
import { playTargetLock, unlockAudio } from '@/lib/astroSim/audio';
import { LUNAR_TARGETS, type LunarTarget } from '@/lib/astroSim/lunar';
import { loadRealMoonTexture, makeProceduralMoonTexture } from '@/lib/astroSim/moonTexture';
import type { Cursor } from './MoonScene';

const MoonScene = dynamic(() => import('./MoonScene'), { ssr: false });

type TextureState = { map: THREE.Texture; real: boolean } | null;

export default function MoonView() {
  const [tex, setTex] = useState<TextureState>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [grid, setGrid] = useState(true);
  const [sound, setSound] = useState(true);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<{ latDeg: number; lonDeg: number; n: number } | null>(null);
  const [pinned, setPinned] = useState<LunarTarget | null>(null);
  const lastLocked = useRef<LunarTarget | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Opening view = the sub-Earth point, i.e. the face the Moon shows us right now.
  const initialView = useMemo(() => {
    const lib = moonLibration(new Date());
    return { latDeg: lib.elatDeg, lonDeg: lib.elonDeg };
  }, []);

  useEffect(() => {
    let alive = true;
    loadRealMoonTexture().then((real) => {
      if (!alive) return;
      setTex(real ? { map: real, real: true } : { map: makeProceduralMoonTexture(), real: false });
    });
    return () => {
      alive = false;
    };
  }, []);

  const onCursor = useCallback((c: Cursor | null) => {
    setCursor(c);
    const t = c?.target ?? null;
    if (t && t !== lastLocked.current && soundRef.current) playTargetLock();
    lastLocked.current = t;
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LUNAR_TARGETS.filter((t) => !q || t.name.toLowerCase().includes(q) || t.type.includes(q));
  }, [query]);

  const shown = cursor?.target ?? pinned;
  const unverified = shown?.status !== 'VERIFIED';

  return (
    <div className="relative flex flex-col h-[calc(100dvh-57px)] lg:flex-row" onPointerDown={unlockAudio}>
      <div className="relative flex-1 min-h-[50vh] touch-none">
        {tex ? (
          <MoonScene map={tex.map} gridVisible={grid} focus={focus} initialView={initialView} onCursor={onCursor} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs tracking-widest uppercase text-slate-500">Rendering surface…</div>
        )}

        {/* Top-left: what the pixels are. */}
        <div className="absolute flex flex-col gap-2 top-3 left-3">
          <ModeBadge
            mode={tex?.real ? 'ENHANCED' : 'SIM'}
            note={
              tex?.real
                ? 'Equirectangular lunar map from NASA/LRO data, rendered on a sphere'
                : 'No real lunar map is bundled in this build. This is a procedural stand-in, not imagery of the Moon'
            }
          />
          {!tex?.real && tex && (
            <p className="max-w-[16rem] text-[10px] leading-snug text-fuchsia-200/80">
              Procedural surface. Add public/textures/moon.jpg (NASA LRO map) for real imagery.
            </p>
          )}
        </div>

        {/* Bottom-left: live cursor coordinates, straight from the mesh hit. */}
        <div className="absolute px-3 py-2 text-[11px] border rounded bottom-3 left-3 border-cyan-500/30 bg-black/50 text-cyan-200 tabular-nums">
          {cursor ? `${formatLat(cursor.latDeg)}  ${formatLon(cursor.lonDeg)}` : 'Move over the Moon to aim'}
        </div>

        <div className="absolute flex gap-2 top-3 right-3">
          <button
            onClick={() => setGrid((g) => !g)}
            aria-pressed={grid}
            className={`flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border transition ${grid ? 'border-cyan-500/60 text-cyan-300 bg-cyan-500/10' : 'border-neutral-700 text-white/60 bg-slate-900/60'}`}
          >
            <Grid3x3 className="w-3.5 h-3.5" /> Grid
          </button>
          <button
            onClick={() => {
              unlockAudio();
              setSound((s) => !s);
            }}
            aria-pressed={sound}
            aria-label="Toggle lock sound"
            className="flex items-center justify-center w-8 h-8 border rounded border-neutral-700 text-white/70 bg-slate-900/60 hover:text-white"
          >
            {sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* HUD + target list */}
      <aside className="flex flex-col w-full border-t lg:w-80 lg:border-t-0 lg:border-l border-slate-800 bg-[#07090E] min-h-0">
        <div className="p-4 border-b border-slate-800">
          <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">{cursor?.target ? 'Target lock' : pinned ? 'Selected' : 'No target'}</p>
          {shown ? (
            <>
              <p className={`mt-1 text-lg font-bold ${cursor?.target ? 'text-amber-300' : 'text-white'}`}>{shown.name}</p>
              <p className="text-[11px] uppercase text-slate-400">{shown.type}</p>
              <dl className="grid grid-cols-2 mt-3 text-[11px] gap-y-1.5 tabular-nums">
                <dt className="text-slate-500">Lat</dt>
                <dd className="text-right text-slate-100">{formatLat(shown.latDeg)}</dd>
                <dt className="text-slate-500">Lon</dt>
                <dd className="text-right text-slate-100">{formatLon(shown.lonDeg)}</dd>
                <dt className="text-slate-500">Diameter</dt>
                <dd className="text-right text-slate-100">{shown.diameterKm != null ? `${shown.diameterKm} km` : '—'}</dd>
                <dt className="text-slate-500">Depth</dt>
                <dd className="text-right text-slate-100">{shown.depthKm != null ? `${shown.depthKm} km` : '—'}</dd>
              </dl>
              {unverified && (
                <p className="mt-3 text-[10px] leading-snug text-rose-300/90">
                  UNVERIFIED: coordinates not yet checked against the IAU/USGS Gazetteer.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Sweep the reticle over a named feature, or pick one below.</p>
          )}
        </div>

        <div className="relative px-4 py-2 border-b border-slate-800">
          <Search className="absolute w-3.5 h-3.5 top-4 left-6 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${LUNAR_TARGETS.length} targets`}
            className="w-full h-8 pl-8 pr-2 text-xs bg-slate-900/60 border rounded border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto max-h-48 lg:max-h-none">
          {list.map((t) => (
            <li key={t.name}>
              <button
                onClick={() => {
                  setPinned(t);
                  setFocus({ latDeg: t.latDeg, lonDeg: t.lonDeg, n: Date.now() });
                }}
                className="flex items-baseline justify-between w-full gap-2 px-4 py-1.5 text-left text-xs hover:bg-white/5"
              >
                <span className="truncate text-slate-200">{t.name}</span>
                <span className="text-[10px] uppercase text-slate-600 shrink-0">{t.type}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
