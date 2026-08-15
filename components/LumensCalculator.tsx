'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { calculateLumensPlan, type LumensPlan } from '@/lib/lumens';

interface LumensCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Ported from an archived prototype (_local-archive/assets-cleanup/
// LumensCalculator.tsx) — that copy imported a nonexistent
// "../app/lib/lumens" module and used a "veridian" Tailwind color this
// project never defined, so nothing there actually rendered or ran. Fixed
// to use the real lib/lumens.ts and this app's existing dark HUD palette.
// A "Light Type" purpose selector from the original was dropped — it was
// never actually wired into the calculation there either, just an inert
// dropdown.
const LIGHT_LEVELS = ['High Level', 'Daylight', 'Twilight', 'Full Moon'] as const;

const PRESETS: Record<(typeof LIGHT_LEVELS)[number], { name: string; footcandles: number }[]> = {
  'High Level': [
    { name: 'Office Work', footcandles: 50 },
    { name: 'Retail Display', footcandles: 100 },
    { name: 'Detailed Tasks', footcandles: 75 },
    { name: 'Art Studio', footcandles: 150 },
  ],
  Daylight: [
    { name: 'Living Room', footcandles: 30 },
    { name: 'Kitchen', footcandles: 50 },
    { name: 'Bedroom', footcandles: 20 },
    { name: 'Bathroom', footcandles: 75 },
  ],
  Twilight: [
    { name: 'Hallway', footcandles: 10 },
    { name: 'Ambient', footcandles: 5 },
    { name: 'Night Light', footcandles: 2 },
    { name: 'Path Lighting', footcandles: 3 },
  ],
  'Full Moon': [
    { name: 'Minimal', footcandles: 0.5 },
    { name: 'Emergency', footcandles: 1 },
    { name: 'Security', footcandles: 2 },
    { name: 'Accent', footcandles: 1.5 },
  ],
};

export default function LumensCalculator({ isOpen, onClose }: LumensCalculatorProps) {
  const [roomLength, setRoomLength] = useState<number>(0);
  const [roomWidth, setRoomWidth] = useState<number>(0);
  const [ceilingHeight, setCeilingHeight] = useState<number>(9);
  const [footcandles, setFootcandles] = useState<number>(0);
  const [selectedLevel, setSelectedLevel] = useState<(typeof LIGHT_LEVELS)[number]>('High Level');
  const [plan, setPlan] = useState<LumensPlan | null>(null);

  if (!isOpen) return null;

  const calculate = () => {
    if (!roomLength || !roomWidth || !footcandles) {
      setPlan(null);
      return;
    }
    setPlan(calculateLumensPlan({ length: roomLength, width: roomWidth, footcandles, ceilingHeight }));
  };

  const handleSave = () => {
    if (!plan) return;
    const content = `Q-FLOW LUMENS CALCULATION (BETA DEMO)
========================

Room Dimensions:
- Length: ${roomLength} ft
- Width: ${roomWidth} ft
- Ceiling Height: ${ceilingHeight} ft
- Area: ${roomLength * roomWidth} sq ft

Target: ${footcandles} fc (${selectedLevel})

RESULT:
- Total Lumens: ${plan.totalLumens.toLocaleString()} lm
- Bulb Count: ${plan.bulbCount}
- Watts Total (est.): ${plan.wattsTotal}
- Suggested Placement: ${plan.placement.join(', ')}

Generated: ${new Date().toLocaleString()}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `q-flow-calculation-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute text-slate-500 top-4 right-4 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <div>
          <h3 className="text-lg font-bold text-white">Q-Flow Lumens Calculator</h3>
          <span className="inline-block px-1.5 py-0.5 mt-1 text-[9px] font-mono uppercase tracking-wider border rounded bg-slate-950 text-slate-500 border-slate-800">
            Beta Demo Only
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block mb-1 text-[10px] font-mono uppercase text-slate-500">Length (ft)</label>
            <input
              type="number"
              min={0}
              value={roomLength || ''}
              onChange={(e) => setRoomLength(Number(e.target.value))}
              className="w-full p-2 font-mono text-sm border rounded bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-mono uppercase text-slate-500">Width (ft)</label>
            <input
              type="number"
              min={0}
              value={roomWidth || ''}
              onChange={(e) => setRoomWidth(Number(e.target.value))}
              className="w-full p-2 font-mono text-sm border rounded bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-mono uppercase text-slate-500">Ceiling (ft)</label>
            <input
              type="number"
              min={1}
              value={ceilingHeight}
              onChange={(e) => setCeilingHeight(Number(e.target.value))}
              className="w-full p-2 font-mono text-sm border rounded bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
          </div>
        </div>

        <div>
          <label className="block mb-1 text-[10px] font-mono uppercase text-slate-500">Light Level</label>
          <div className="flex gap-1">
            {LIGHT_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedLevel(level)}
                className={`flex-1 px-2 py-1.5 text-[10px] font-mono rounded border transition ${
                  selectedLevel === level
                    ? 'bg-white/20 text-white border-neutral-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block mb-1 text-[10px] font-mono uppercase text-slate-500">
            Target Footcandles (FC): {footcandles}
          </label>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={footcandles}
            onChange={(e) => setFootcandles(Number(e.target.value))}
            className="w-full h-1.5 accent-white bg-slate-950 rounded-lg cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1 mt-2">
            {PRESETS[selectedLevel].map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setFootcandles(preset.footcandles)}
                className="px-1.5 py-1 text-[9px] font-mono transition border rounded bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={calculate}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-wide transition rounded bg-white hover:bg-neutral-200 text-slate-950"
        >
          Calculate
        </button>

        <div className="p-4 space-y-1 text-center border rounded-lg bg-slate-950/60 border-slate-800">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Required Lumens</div>
          <div className="text-2xl font-bold text-white">{plan ? `${plan.totalLumens.toLocaleString()} lm` : '—'}</div>
          {plan && (
            <div className="pt-1 space-y-0.5 font-mono text-[10px] text-slate-500">
              <div>Bulbs: {plan.bulbCount} · Watts (est.): {plan.wattsTotal}</div>
              {plan.placement.length > 0 && <div>{plan.placement.join(' · ')}</div>}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!plan}
          className="w-full py-2 text-[11px] font-mono uppercase tracking-wide transition border rounded border-neutral-700 text-white/80 hover:bg-white/10 disabled:opacity-40"
        >
          Save Result
        </button>
      </div>
    </div>
  );
}
