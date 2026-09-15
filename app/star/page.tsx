'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Real, shareable URL for the dashboard's Star Tracker PRO card
// (GalleryGrid). Redirects straight back into '/' with ?tracker=open so
// the existing in-hub fixed-overlay Star Tracker view opens over the
// dashboard the visitor came from — deliberately not a copy of, or
// redirect to, app/(standalone)/star-tracker/page.tsx: that page is built
// for a dedicated subdomain and its Back button hard-exits to the external
// protolabsglobal.com marketing site, which would strand someone who
// actually arrived via this hub.
export default function StarTrackerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?tracker=open');
  }, [router]);

  return null;
}
