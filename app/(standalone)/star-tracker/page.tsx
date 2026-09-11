'use client';

import StarTrackerProBackground from '@/components/starTrackerPro/StarTrackerProBackground';
import StarTrackerView from '@/components/StarTrackerView';

// Reached at /star-tracker on any domain pointing at this deployment, and
// rewritten here transparently from `/` on startracker.pro.protolabsglobal.com
// via proxy.ts. No parent app shell wraps this — both pieces below are
// already self-contained fixed-inset-0 overlays, so this renders correctly
// as a standalone page on its own.
//
// Phase 2: StarTrackerProCanvas's WebGL/R3F celestial sphere is now the
// background layer (StarTrackerProBackground — the bare scene, no chrome
// of its own) with the full legacy StarTrackerView dashboard (Kali Yuga
// epoch, sidereal time, telemetry gauges, DSN/Deep Sky/Space Media,
// Messier dome, Ask Kali) layered on top as the real HUD, replacing
// StarTrackerProCanvas's own minimal chrome (Back button/toolbar/Device
// Hub), which duplicated what StarTrackerView already provides.
// StarTrackerView's own root is pointer-events-none (see that component)
// so empty space around its panels still reaches the WebGL canvas below.
export default function StandaloneStarTrackerPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <StarTrackerProBackground />
      <StarTrackerView
        onBack={() => {
          // Not "back" to anything within this page — this domain has
          // nothing else to navigate to. Sends the visitor to the real
          // Proto Labs Global root site (protolabsglobal-main-shell, a
          // separate repo/deployment), not this app's own origin — that
          // would just reload this same standalone page. Locally that
          // shell runs on its own static server at :5500 (see
          // protolabsglobal-main-shell-site's README), not whatever port
          // `next dev` happens to be bound to; production points at the
          // real separate domain. Mirrors TopHeader.tsx's own back button.
          window.location.href = process.env.NODE_ENV === 'production' ? 'https://www.protolabsglobal.com' : 'http://localhost:5500';
        }}
      />
    </div>
  );
}
