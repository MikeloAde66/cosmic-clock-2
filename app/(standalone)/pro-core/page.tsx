// Embeds the actual running star-tracker-pro-core service (Alpaca/INDI
// hardware bridge + voice HUD, see /star-tracker-pro-core in this repo)
// via iframe, rather than reimplementing its UI here — any future HUD
// changes made there show up here for free, with no risk of two copies
// drifting apart.
//
// Now deployed on Render (chosen over Vercel/cPanel: it needs a
// persistent WebSocket server, which serverless doesn't support — see
// render.yaml). In dev this still defaults to localhost:4000 so a
// developer running both services locally sees their own local instance,
// not the shared deployed one. NEXT_PUBLIC_PRO_CORE_URL overrides either
// default, same pattern as the StarTracker/TopHeader back-button URLs
// elsewhere in this app.
//
// Either way, remember this only ever exposes the UI/voice/catalog demo
// experience — the Alpaca/INDI calls inside it target localhost on
// whichever machine actually runs the service (Render's server, which has
// no telescope attached), not the visitor's own machine.
const PRO_CORE_URL =
  process.env.NEXT_PUBLIC_PRO_CORE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://star-tracker-pro-core.onrender.com' : 'http://localhost:4000');

export default function ProCorePage() {
  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-neutral-900/80 border-b border-neutral-800">
        <div>
          <div className="text-sm font-bold text-white">Star Tracker Pro Core</div>
          <div className="text-xs text-neutral-400">
            Live hardware bridge &amp; voice HUD — a UI/voice/catalog demo; no real telescope is attached to this
            deployment.
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
