'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Same shape/convention as useKaliPendingApprovals' isAdmin check — null
// while the session check is still in flight, so callers can distinguish
// "still checking" (don't gate yet, avoid a false-positive flash of the
// trial modal) from "checked, genuinely signed out."
export function useIsSignedIn() {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsSignedIn(!!data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return isSignedIn;
}
