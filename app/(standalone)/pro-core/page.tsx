// Embeds the actual running star-tracker-pro-core service (Alpaca/INDI
// hardware bridge + voice HUD, see /star-tracker-pro-core in this repo)
// via iframe, rather than reimplementing its UI here — any future HUD
// changes made there show up here for free, with no risk of two copies
// drifting apart.
//
// star-tracker-pro-core has no public deployment yet — it's a separate
// local Node service. NEXT_PUBLIC_PRO_CORE_URL lets this be pointed
// somewhere else once/if it's deployed; defaults to localhost:4000, which
// browsers treat as reachable even from an HTTPS page (localhost is
// exempted from mixed-content blocking). Until then, visiting this route
// without the service running locally will show a failed-to-load iframe —
// that's an honest reflection of the current setup, not a broken link
// pointing somewhere that doesn't exist.
const PRO_CORE_URL = process.env.NEXT_PUBLIC_PRO_CORE_URL || 'http://localhost:4000';

export default function ProCorePage() {
  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-neutral-900/80 border-b border-neutral-800">
        <div>
          <div className="text-sm font-bold text-white">Star Tracker Pro Core</div>
          <div className="text-xs text-neutral-400">
            Live hardware bridge &amp; voice HUD — requires the pro-core service running locally on port 4000.
          </div>
        </div>
        <a
          href="/"
          className="shrink-0 px-3 py-1 text-xs border rounded bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-neutral-300"
        >
          ← Back
        </a>
      </div>
      <iframe src={PRO_CORE_URL} title="Star Tracker Pro Core" className="flex-1 w-full border-0" />
    </div>
  );
}
