// Every view declares what its imagery really is. LIVE = a current feed from
// a real instrument; ENHANCED = real data that has been processed, coloured
// or rendered; SIM = procedural/simulated, not an observation.
export type DataMode = 'LIVE' | 'ENHANCED' | 'SIM';

const STYLE: Record<DataMode, string> = {
  LIVE: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10',
  ENHANCED: 'text-amber-300 border-amber-500/50 bg-amber-500/10',
  SIM: 'text-fuchsia-300 border-fuchsia-500/50 bg-fuchsia-500/10',
};

const MEANING: Record<DataMode, string> = {
  LIVE: 'Live image from a real instrument',
  ENHANCED: 'Real data, processed or rendered',
  SIM: 'Simulated. Not a real observation',
};

export default function ModeBadge({ mode, note }: { mode: DataMode; note?: string }) {
  return (
    <span
      title={note ?? MEANING[mode]}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-[0.2em] uppercase border rounded ${STYLE[mode]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${mode === 'LIVE' ? 'animate-pulse' : ''}`} />
      {mode}
    </span>
  );
}
