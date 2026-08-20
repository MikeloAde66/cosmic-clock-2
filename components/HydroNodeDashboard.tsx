'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, AlertTriangle, Droplet, Thermometer, Cpu, Send } from 'lucide-react';

interface TelemetryPoint {
  time: string;
  tds: number;
}

// Interactive demo of the real HydroNode Pro/Builder Kit product's water-
// quality classification logic (see lib/hardwareProducts.ts) — the
// sliders are honestly user-driven, so there's nothing deceptive about
// them. Two things from the original spec were dropped as genuinely
// misleading rather than just unstyled: an auto-jittering "Live Sensor
// Telemetry Stream (ADS1115 ADC Channel Readout, Sampling Rate: 0.5Hz)"
// with no real device behind it (a visitor would reasonably read that as
// actual hardware data), and a "Download OS Disk Image" button whose only
// behavior was an alert() claiming a 32GB file was downloading — no such
// file exists anywhere in this repo. The history chart below instead logs
// real user interactions (slider moves), and downloads route to the real
// product page instead of a fake file.
export default function HydroNodeDashboard({ onSendToKali }: { onSendToKali?: (summary: string) => void }) {
  const [tds, setTds] = useState<number>(145); // ppm
  const [turbidity, setTurbidity] = useState<number>(2.1); // NTU
  const [ph, setPh] = useState<number>(7.2);
  const [temp, setTemp] = useState<number>(21.5); // °C
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

  const logAdjustment = (nextTds: number) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory((prev) => [...prev, { time, tds: nextTds }].slice(-12));
  };

  const getQualityAssessment = () => {
    if (tds > 500 || turbidity > 5.0 || ph < 6.5 || ph > 8.5) {
      return {
        status: 'CRITICAL',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        message: 'Contamination/high sediment threshold exceeded',
      };
    }
    if (tds > 300 || turbidity > 3.0 || ph < 6.8 || ph > 7.8) {
      return {
        status: 'WARNING',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        message: 'Elevated particulates — filtration advised',
      };
    }
    return {
      status: 'OPTIMAL',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      message: 'Water parameters nominal — safe potability range',
    };
  };

  const assessment = getQualityAssessment();
  const [copied, setCopied] = useState(false);

  const handleSendToKali = () => {
    const promptSummary = `[HydroNode demo scenario — hypothetical readings I set on the interactive dashboard, not a real device]
- Classification: ${assessment.status} (${assessment.message})
- TDS (Total Dissolved Solids): ${tds} ppm
- Turbidity: ${turbidity} NTU
- pH Level: ${ph}
- Water Temp: ${temp}°C
Kali, given these hypothetical readings, walk through the water chemistry and what filtration or treatment they'd call for.`;

    if (onSendToKali) {
      onSendToKali(promptSummary);
    } else {
      // This standalone product page has no Kali chat context to hand off
      // to (onSendToKali is only ever passed by an embedding that does) —
      // copy to clipboard with real visible feedback instead of doing
      // nothing silently.
      navigator.clipboard.writeText(promptSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100">
      <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">HydroNode™ Interactive Demo</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Simulated
              </span>
            </div>
            <p className="text-xs text-slate-400">Drag the sliders to see the classification logic respond</p>
          </div>
        </div>

        <button
          onClick={handleSendToKali}
          className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-lg shadow-cyan-500/20"
        >
          <Send className="w-3.5 h-3.5" />
          {copied ? 'Copied!' : onSendToKali ? 'Analyze with Kali' : 'Copy for Kali'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className={`p-4 rounded-xl border ${assessment.bg} ${assessment.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {assessment.status === 'OPTIMAL' ? (
              <ShieldCheck className={`w-5 h-5 ${assessment.color}`} />
            ) : (
              <AlertTriangle className={`w-5 h-5 ${assessment.color}`} />
            )}
            <div>
              <span className={`text-xs font-mono font-bold uppercase ${assessment.color}`}>
                Classification: {assessment.status}
              </span>
              <p className="mt-0.5 text-xs text-slate-300">{assessment.message}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden p-4 border rounded-xl bg-slate-900/60 border-slate-800/80">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-xs text-slate-400">TDS (Solids)</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">{tds}</span>
              <span className="font-mono text-xs text-slate-400">ppm</span>
            </div>
            <input
              type="range"
              min="20"
              max="800"
              value={tds}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTds(v);
                logAdjustment(v);
              }}
              className="w-full h-1 mt-3 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="relative overflow-hidden p-4 border rounded-xl bg-slate-900/60 border-slate-800/80">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-xs text-slate-400">Turbidity</span>
              <Droplet className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">{turbidity}</span>
              <span className="font-mono text-xs text-slate-400">NTU</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10.0"
              step="0.1"
              value={turbidity}
              onChange={(e) => setTurbidity(Number(e.target.value))}
              className="w-full h-1 mt-3 bg-slate-800 rounded-lg cursor-pointer accent-blue-400"
            />
          </div>

          <div className="relative overflow-hidden p-4 border rounded-xl bg-slate-900/60 border-slate-800/80">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-xs text-slate-400">pH Level</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">{ph}</span>
              <span className="font-mono text-xs text-slate-400">pH</span>
            </div>
            <input
              type="range"
              min="4.0"
              max="10.0"
              step="0.1"
              value={ph}
              onChange={(e) => setPh(Number(e.target.value))}
              className="w-full h-1 mt-3 bg-slate-800 rounded-lg cursor-pointer accent-purple-400"
            />
          </div>

          <div className="relative overflow-hidden p-4 border rounded-xl bg-slate-900/60 border-slate-800/80">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-xs text-slate-400">Water Temp</span>
              <Thermometer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">{temp}</span>
              <span className="font-mono text-xs text-slate-400">°C</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="45.0"
              step="0.5"
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="w-full h-1 mt-3 bg-slate-800 rounded-lg cursor-pointer accent-amber-400"
            />
          </div>
        </div>

        {history.length > 0 && (
          <div className="p-5 border rounded-xl bg-slate-900/50 border-slate-800/80">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
                Your TDS adjustments this session
              </h3>
            </div>
            <div className="flex items-end h-32 gap-2 p-3 border rounded-lg bg-slate-950 border-slate-900">
              {history.map((pt, idx) => {
                const heightPercent = Math.min(100, Math.max(10, (pt.tds / 800) * 100));
                return (
                  <div key={idx} className="relative flex flex-col items-center justify-end flex-1 h-full group">
                    <div className="absolute z-10 flex-col items-center hidden px-2 py-1 -top-9 group-hover:flex bg-slate-900 border border-slate-700 rounded text-[10px] font-mono whitespace-nowrap shadow-xl">
                      <span className="text-cyan-300">{pt.tds} ppm</span>
                      <span className="text-slate-400">{pt.time}</span>
                    </div>
                    <div
                      className="w-full transition-all duration-300 rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-xl bg-slate-900/30 border-slate-800/60">
          <div>
            <h4 className="text-xs font-semibold text-slate-200">Want to build a physical HydroNode™?</h4>
            <p className="text-xs text-slate-400">See real specs, pricing, and pre-order the actual hardware.</p>
          </div>
          <Link
            href="/products/hydronode-pro"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 rounded-lg transition-all"
          >
            View HydroNode Pro →
          </Link>
        </div>
      </div>
    </div>
  );
}
