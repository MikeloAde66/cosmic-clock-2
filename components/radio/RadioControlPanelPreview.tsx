'use client';

import React from 'react';
import { AudioLines, Plus, Search } from 'lucide-react';
import { CATEGORIES, CATEGORY_LABELS, MEDIA_GENRE_FILTERS } from '@/lib/radioStations';

// A static visual clone of Radio Central's own header control panel
// (RadioCentralConsoleView.tsx's 432Hz badge / Program Manager / Daily
// Queue / category & genre filters), deliberately NOT wired to
// useRadioPlayer or any real playback state — every control here is inert
// by design (no onClick, disabled inputs), staged ahead of Media Flow
// being wired up as the real source of truth for multi-agent (n8n)
// queue automation. The "PREVIEW" badge exists so this never reads as a
// working control surface it isn't yet.
const TOKENS = {
  card: '#0B101D',
  subpanel: '#0e1626',
  cyan: '#00F2FE',
};
const glowBorder = '1px solid rgba(0,242,254,0.2)';
const glowShadow = '0 0 15px rgba(0,242,254,0.15)';
const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const cardStyle: React.CSSProperties = { background: TOKENS.card, border: glowBorder, boxShadow: glowShadow };
const subpanelStyle: React.CSSProperties = { background: TOKENS.subpanel, border: glowBorder };

export default function RadioControlPanelPreview() {
  return (
    <div className="mb-6 space-y-3" style={{ fontFamily: monoFont }}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Radio Central control panel — cloned layout</span>
        <span
          className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
        >
          Preview — not yet connected
        </span>
      </div>

      {/* Header */}
      <div
        className="flex flex-col gap-4 p-4 rounded-xl md:flex-row md:items-center md:justify-between opacity-90"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full" style={{ ...subpanelStyle, color: TOKENS.cyan }}>
            <AudioLines className="w-3.5 h-3.5" />
            432Hz
          </span>
          <button
            type="button"
            disabled
            aria-label="Upload audio (preview only)"
            title="Preview only — not wired up yet"
            className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 cursor-not-allowed"
            style={{ background: TOKENS.cyan, color: '#03121a', opacity: 0.5 }}
          >
            <Plus className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold tracking-[0.2em] text-white">RADIO CENTRAL</h3>
          <p className="text-[10px] tracking-widest uppercase" style={{ color: TOKENS.cyan }}>
            Live streaming stations, curated ambient/cosmic channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-400">Program Manager</span>
          <span
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full cursor-default"
            style={{ ...subpanelStyle, color: '#64748b' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#64748b' }} />
              Program Manager &bull; Off
            </span>
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-400">Daily Queue</span>
          <span
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full cursor-default opacity-60"
            style={{ ...subpanelStyle, color: '#64748b' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#64748b' }} />
              Daily Queue &bull; Off
            </span>
          </span>
        </div>
      </div>

      {/* Filter sub-nav */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl opacity-90" style={cardStyle}>
        {CATEGORIES.map((cat, i) => (
          <span
            key={cat}
            className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wide cursor-default"
            style={i === 0 ? { background: 'rgba(0,242,254,0.12)', border: `1px solid ${TOKENS.cyan}`, color: TOKENS.cyan } : { ...subpanelStyle, color: '#94a3b8' }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-2.5 top-1/2 text-slate-500" />
          <input
            type="text"
            disabled
            placeholder="Filter stations..."
            className="w-full py-1.5 pl-8 pr-3 text-xs rounded-full outline-none cursor-not-allowed"
            style={{ ...subpanelStyle, color: '#e2e8f0' }}
          />
        </div>
      </div>

      {/* Mini-category sub-nav */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl opacity-90" style={cardStyle}>
        <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0">Genre</span>
        {MEDIA_GENRE_FILTERS.map((genreFilter) => (
          <span
            key={genreFilter.label}
            className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wide cursor-default"
            style={{ ...subpanelStyle, color: '#94a3b8' }}
          >
            {genreFilter.label}
          </span>
        ))}
      </div>
    </div>
  );
}
