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
        // nothing else to navigate to. Sends the visitor to the real main
        // hub instead of a dead/no-op button.
        window.location.href = 'https://aione.pro.protolabsglobal.com';
      }}
    />
  );
}
