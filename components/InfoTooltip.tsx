'use client';

import React, { useState } from 'react';

// Reusable glossary tooltip for HUD telemetry labels. Adapted from a pasted
// spec — trimmed the "✨ Smart Lens Active" decorative label since it named
// a capability with no real function; the "Ask Kali" row here only renders
// when a real onAskKali handler is passed in, and it's a genuine navigation
// + prefill action (see StarTrackerView's onAskKali prop), not a static
// label.
interface InfoTooltipProps {
  term: string;
  explanation: string;
  askKaliQuery?: string;
  onAskKali?: (query: string) => void;
}

export default function InfoTooltip({ term, explanation, askKaliQuery, onAskKali }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center gap-1">
      <span className="cursor-help border-b border-dotted border-cyan-500/50 hover:border-cyan-400 hover:text-cyan-300 transition-colors">
        {term}
      </span>
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="w-3.5 h-3.5 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center border border-slate-700 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-500 transition-all"
        aria-label={`More information about ${term}`}
      >
        ?
      </button>

      {isVisible && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-950/95 border border-cyan-500/30 rounded-lg shadow-xl shadow-cyan-950/20 backdrop-blur-md z-50 text-xs">
          <p className="text-slate-200 font-sans leading-relaxed">{explanation}</p>

          {askKaliQuery && onAskKali && (
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => onAskKali(askKaliQuery)}
                className="text-[10px] text-cyan-400 font-mono hover:underline hover:text-cyan-300"
              >
                Ask Kali →
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
