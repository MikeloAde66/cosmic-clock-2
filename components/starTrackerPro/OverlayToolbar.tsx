'use client';

import React, { useState } from 'react';
import { Search, Sparkles, Grid3x3 } from 'lucide-react';

// Real, fixed set of named bodies this app can actually resolve a position
// for (astronomy-engine's Sun/Moon/planets — the same real tracked-body
// list the legacy StarTrackerView used). Deliberately NOT a search over
// the star catalog itself: public/data/stars.json carries no names (see
// starCatalogBuffers.ts), so "search for a star by name" isn't answerable
// with real data — this only searches things this app can genuinely name.
export const SEARCHABLE_BODY_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

export interface OverlayToolbarProps {
  showConstellations: boolean;
  onToggleConstellations: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  onSearchSelect: (bodyName: string) => void;
}

export default function OverlayToolbar({
  showConstellations,
  onToggleConstellations,
  showGrid,
  onToggleGrid,
  onSearchSelect,
}: OverlayToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = query.trim()
    ? SEARCHABLE_BODY_NAMES.filter((name) => name.toLowerCase().startsWith(query.trim().toLowerCase()))
    : SEARCHABLE_BODY_NAMES;

  const toggleClass = (active: boolean) =>
    `flex items-center justify-center w-9 h-9 rounded-full border transition ${
      active ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'
    }`;

  return (
    <div className="fixed z-20 flex items-start gap-2 top-4 left-1/2 -translate-x-1/2">
      <div className="flex items-center gap-2 px-2 py-2 border rounded-full shadow-lg border-slate-800 bg-slate-950/70 backdrop-blur-md">
        <button type="button" title="Constellation lines" onClick={onToggleConstellations} className={toggleClass(showConstellations)}>
          <Sparkles className="w-4 h-4" />
        </button>
        <button type="button" title="Alt-Az grid" onClick={onToggleGrid} className={toggleClass(showGrid)}>
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button type="button" title="Target search" onClick={() => setSearchOpen((v) => !v)} className={toggleClass(searchOpen)}>
          <Search className="w-4 h-4" />
        </button>
      </div>

      {searchOpen && (
        <div className="w-56 p-2 border rounded-lg shadow-lg border-slate-800 bg-slate-950/90 backdrop-blur-md">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sun, Moon, Mars…"
            className="w-full px-2 py-1.5 mb-1.5 text-xs font-mono bg-slate-900/80 border border-slate-700 rounded outline-none text-slate-200"
          />
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {matches.length === 0 && <p className="px-2 py-1 text-[11px] font-mono text-slate-500">No match.</p>}
            {matches.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onSearchSelect(name);
                  setSearchOpen(false);
                  setQuery('');
                }}
                className="w-full px-2 py-1 text-xs font-mono text-left rounded text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
