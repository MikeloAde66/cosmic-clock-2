'use client';

import StarTrackerView from '@/components/StarTrackerView';

// Reached at /star-tracker on any domain pointing at this deployment, and
// rewritten here transparently from `/` on startracker.pro.protolabsglobal.com
// via proxy.ts. No parent app shell wraps this — StarTrackerView is
// already a self-contained fixed-inset-0 overlay, so it renders correctly
// as a standalone page on its own.
export default function StandaloneStarTrackerPage() {
  return (
    <StarTrackerView
      onBack={() => {
        // Not "back" to anything within this page — this domain has
        // nothing else to navigate to. Sends the visitor to the real
        // Proto Labs Global root site (protolabsglobal-main-shell, a
        // separate repo/deployment) instead of a dead/no-op button —
        // previously pointed at the aione subdomain itself, trapping the
        // visitor in this app. In development that shell runs locally on
        // port 5500; production points at the real domain.
        window.location.href = process.env.NODE_ENV === 'production' ? 'https://protolabsglobal.com' : 'http://localhost:5500';
      }}
    />
  );
}
