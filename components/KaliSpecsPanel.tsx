'use client';

import React from 'react';
import { Cpu, ChevronDown } from 'lucide-react';

// Inline expand/collapse panel, not a modal/drawer overlay — consistent
// with this app's "dedicated content, no stacked popups" rule (see
// feedback_dedicated-views-not-modals in project memory). It still reads
// as a "specs drawer" (slides open, structured readout) without risking
// the fixed-height clipping bug that rule exists to avoid.
//
// Wording below is trimmed to what Kali's quantum tool actually does
// (see app/api/ai-one-chat/route.ts + quantum-service/) rather than the
// more grandiose "Autonomous Intent Planning" framing it was requested
// with — the real behavior is a one-sentence preview before the tool call
// and up to 3 retries on error, not a separate planning subsystem. Example
// Workloads lists genuine things the tool can run, not a fixed/certified
// capability list — it executes any valid Braket circuit, these are just
// representative examples.
const SPECS = [
  { label: 'Engine Architecture', value: 'Hybrid Next.js / FastAPI Python microservice' },
  { label: 'Quantum SDK', value: 'Amazon Braket — LocalSimulator, 1,000-shot execution' },
  { label: 'Agentic Capability', value: 'States intent before executing; retries automatically on error, up to 3 attempts' },
  { label: 'Supported Output', value: 'ASCII circuit diagrams, measurement shot counts, probability distributions' },
  { label: 'Example Workloads', value: 'Bell/GHZ entanglement, parameterized rotations, teleportation, Grover search' },
];

// Split into a trigger button (rendered next to Kali's title, in a narrow
// row) and the panel content (rendered separately, full width, below the
// whole header block) — a single component can't do both without either
// cramping the expanded content into that narrow row or breaking the flex
// layout it sits in. Shared open state lives in the parent (KaliSection).
export function KaliSpecsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-widest rounded border border-cyan-500/20 text-cyan-400/80 hover:text-cyan-300 hover:border-cyan-500/40 transition-all shrink-0"
    >
      <Cpu className="w-3 h-3" />
      Specs
      <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

export function KaliSpecsContent() {
  return (
    <div className="mt-2 space-y-1.5 rounded border border-cyan-500/10 bg-black/40 p-3 font-mono text-[11px]">
      {SPECS.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <span className="shrink-0 uppercase tracking-wide text-cyan-500/70 sm:w-40">{s.label}</span>
          <span className="text-cyan-100">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
