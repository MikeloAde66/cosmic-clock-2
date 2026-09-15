'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Real, shareable URL for the dashboard's Kali Console card (GalleryGrid).
// Redirects straight back into '/' with ?view=kali, the same deep-link
// param already used by external sites (see app/page.tsx's mount effect)
// — no separate component tree, just a real URL onto the existing in-hub
// Kali sub-view.
export default function KaliRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?view=kali');
  }, [router]);

  return null;
}
