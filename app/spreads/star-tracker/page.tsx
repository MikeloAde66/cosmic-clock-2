'use client';

import DigitalMagazineSpread from '@/components/magazine/DigitalMagazineSpread';
import { starTrackerSpread } from '@/lib/spreads/starTracker';

// Not mounted at /star: that route is the existing redirect into the
// native in-hub Star Tracker PRO overlay (StarTrackerView +
// StarTrackerProBackground) — a different, already-shipped component.
// This is the migrated protolabsglobal-main-shell/index.star.html
// "digital magazine" spread, built on the reusable template so future
// spreads (geology, ancient history, climate telemetry) are just new
// SpreadConfig objects under lib/spreads/, not new page layouts.
export default function StarTrackerSpreadPage() {
  return <DigitalMagazineSpread config={starTrackerSpread} />;
}
