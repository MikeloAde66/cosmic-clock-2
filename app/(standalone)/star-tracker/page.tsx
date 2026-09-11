'use client';

import StarTrackerProCanvas from '@/components/starTrackerPro/StarTrackerProCanvas';

// Reached at /star-tracker on any domain pointing at this deployment, and
// rewritten here transparently from `/` on startracker.pro.protolabsglobal.com
// via proxy.ts. No parent app shell wraps this — StarTrackerProCanvas is
// already a self-contained fixed-inset-0 overlay, so it renders correctly
// as a standalone page on its own.
//
// Phase 1 rewrite: this now renders the new WebGL/R3F celestial sphere +
// SGP4 Web Worker + ASCOM Alpaca "Device Hub" architecture instead of the
// legacy 2D SVG StarTrackerView (components/StarTrackerView.tsx, kept in
// the repo but no longer routed here) — a deliberate replacement, not an
// addition alongside it. StarTrackerView's other real features that this
// Phase 1 pass doesn't cover yet (Kali narration, DSN Telemetry, Deep Sky
// Spectrum, Space Media, Sky Fest, NOAA space weather, the Observatory
// picker) are intentionally out of scope here — carrying all of that into
// the new minimal-UI design wasn't asked for, and would contradict the
// explicit "don't overcomplicate the visual layout" brief this rewrite was
// built to.
export default function StandaloneStarTrackerPage() {
  return (
    <StarTrackerProCanvas
      onBack={() => {
        // Not "back" to anything within this page — this domain has
        // nothing else to navigate to. Sends the visitor to the real
        // Proto Labs Global root site (protolabsglobal-main-shell, a
        // separate repo/deployment) instead of a dead/no-op button —
        // previously pointed at the aione subdomain itself, trapping the
        // visitor in this app. In development that shell runs locally on
        // port 5500; production points at the real domain.
        window.location.href = process.env.NODE_ENV === 'production' ? 'https://www.protolabsglobal.com' : 'http://localhost:5500';
      }}
    />
  );
}
