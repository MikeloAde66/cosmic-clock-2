'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { PendingApproval } from '@/app/api/kali/pending-approvals/route';

const POLL_INTERVAL_MS = 30000;

async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Only polls at all for a signed-in admin (app_metadata.role === 'admin',
// the same check used throughout this app — see LeftNav.tsx,
// lib/adminAuth.ts) — a non-admin session would just get a 401 from
// /api/kali/pending-approvals on every poll for no reason. Returns
// isAdmin: null while that check is still in flight, so callers can
// distinguish "still checking" from "checked, not an admin."
export function useKaliPendingApprovals() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(data.user?.app_metadata?.role === 'admin'));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(session?.user?.app_metadata?.role === 'admin');
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const refetch = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/kali/pending-approvals', { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApprovals(data.approvals);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals.');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // Calling the memoized `refetch` directly here trips
    // react-hooks/set-state-in-effect (it can't tell the callback is safe) —
    // an inline poll function sidesteps that same as useNoaaSnapshot.ts does.
    async function poll() {
      await refetch();
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAdmin, refetch]);

  return { isAdmin, approvals, error, refetch };
}
