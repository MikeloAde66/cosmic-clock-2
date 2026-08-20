'use client';

import React, { useState } from 'react';
import { useTypewriter } from '@/lib/useTypewriter';

type Variant = 'water' | 'quantum';

interface Assessment {
  status: string;
  color: string;
  bg: string;
  border: string;
}

function getWaterAssessment(tds: number): Assessment {
  if (tds > 500) return { status: 'CRITICAL', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  if (tds > 300) return { status: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  return { status: 'OPTIMAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
}

function getWaterOutput(tds: number): string {
  if (tds > 500)
    return `> KALI_ANALYSIS: TDS threshold reached (${tds} ppm). Heavy particulate load detected. Filtration sequence required. Status: ACTION REQUIRED.`;
  if (tds > 300)
    return `> KALI_ANALYSIS: TDS elevated (${tds} ppm). Particulate load above nominal. Filtration advised. Status: MONITOR.`;
  return `> KALI_ANALYSIS: TDS within range (${tds} ppm). Particulate load nominal. No action needed. Status: NOMINAL.`;
}

function getQuantumAssessment(errorRate: number): Assessment {
  if (errorRate > 60) return { status: 'CRITICAL', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  if (errorRate > 20) return { status: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  return { status: 'OPTIMAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
}

function getQuantumOutput(errorRate: number): string {
  const anomalies = Math.max(0, Math.round(errorRate / 15));
  const anomalyWord = anomalies === 1 ? 'anomaly' : 'anomalies';
  if (errorRate > 60)
    return `> KALI_CORE: Auto-fix loop engaged. ${anomalies} syntax ${anomalyWord} corrected. Error rate exceeds tolerance — re-execution required. Status: FAILED.`;
  if (errorRate > 20)
    return `> KALI_CORE: Auto-fix loop engaged. ${anomalies} syntax ${anomalyWord} corrected. Quantum circuit verified across 1,000 shots. Status: REVIEW RECOMMENDED.`;
  return `> KALI_CORE: Auto-fix loop engaged. ${anomalies} syntax ${anomalyWord} corrected. Quantum circuit verified across 1,000 shots. Status: PASSED.`;
}

// Compact interactive demo shown directly below the hero image on the
// three real hardware product pages that route through
// HardwareProductDetail (hydronode-pro, builder-kit, aione-core — Star
// Tracker has its own separate detail flow and never renders this
// component at all, so it's excluded structurally, not by a special case
// here). Explicitly a client-side simulation, not a live device/backend
// call — the footer note says so, and the analysis text is generated
// locally from the slider value, not fetched from anywhere. The real
// version of the quantum diagnostic (actually executing a circuit via
// Kali's run_quantum_circuit tool) lives in Kali chat, not here — this is
// a fast, zero-cost preview of what that output looks like.
export default function ProductTelemetryDemo({ variant }: { variant: Variant }) {
  const isWater = variant === 'water';
  const [value, setValue] = useState(isWater ? 145 : 8);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const typed = useTypewriter(output ?? '', running, 25);
  const assessment = isWater ? getWaterAssessment(value) : getQuantumAssessment(value);

  const runDiagnostic = () => {
    setOutput(isWater ? getWaterOutput(value) : getQuantumOutput(value));
    // Toggling running off then on (even for an identical result string)
    // forces useTypewriter's effect to restart from the top — it bails out
    // early while active is false, so this reliably retypes the line even
    // if "Run Diagnostic" is clicked twice in a row without moving the
    // slider, when the text itself wouldn't otherwise change.
    setRunning(false);
    queueMicrotask(() => setRunning(true));
  };

  return (
    <div className="p-5 space-y-4 border rounded-xl border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {isWater ? 'Live Telemetry Demo' : 'Live Diagnostic Demo'}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded-full border ${assessment.bg} ${assessment.border} ${assessment.color}`}
        >
          {assessment.status}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono text-xs text-slate-400">{isWater ? 'TDS / Contamination Level' : 'Qubit Error State'}</span>
          <span className="font-mono text-sm text-white">
            {value}
            {isWater ? ' ppm' : '%'}
          </span>
        </div>
        <input
          type="range"
          min={isWater ? 20 : 0}
          max={isWater ? 800 : 100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
        />
      </div>

      <button
        onClick={runDiagnostic}
        className="w-full py-2 text-xs font-mono font-bold tracking-wide uppercase transition rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950"
      >
        Run Diagnostic
      </button>

      <div className="p-3 font-mono text-xs border rounded-lg min-h-[3.5rem] bg-black/60 border-slate-800 text-emerald-400">
        {typed || <span className="text-slate-600">Awaiting diagnostic run…</span>}
        {running && typed.length < (output?.length ?? 0) && <span className="animate-pulse">▋</span>}
      </div>

      <p className="text-[10px] font-mono text-slate-600">Simulated demo — runs entirely client-side, not a live device or backend call.</p>
    </div>
  );
}
