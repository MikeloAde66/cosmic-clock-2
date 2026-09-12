// Shown above an assistant message in AiOneChat.tsx when that reply's
// /api/ai-one-chat response carried the X-Kali-Star-Tracker-Verified
// header — i.e. a real, deterministic ephemeris payload
// (lib/astronomy/ephemeris.ts) was injected into Kali's system prompt for
// that turn, not just her own estimate.
export default function StarTrackerBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded border border-slate-700/80 bg-slate-950/90 shadow-[0_0_10px_rgba(0,0,0,0.4)]">
      <span className="relative flex w-1.5 h-1.5 shrink-0">
        <span className="absolute inline-flex w-full h-full bg-emerald-400 rounded-full opacity-75 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_2px_rgba(16,185,129,0.8)]" />
      </span>
      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300">
        🛡️ STAR TRACKER • VERIFIED ENGINE
      </span>
    </div>
  );
}
