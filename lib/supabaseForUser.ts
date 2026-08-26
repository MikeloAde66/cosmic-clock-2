import { createClient } from '@supabase/supabase-js';

export class UserAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Every other authenticated route in this app (see lib/adminAuth.ts) uses
// the service-role client for both verifying the caller AND performing the
// DB/Storage write, which necessarily bypasses RLS — there's nothing to
// enforce ownership at the database layer, so it's all manual in-code
// checks. The community forum tables use real Postgres RLS instead (see
// supabase/migrations/0001_community_forum.sql), which only works if the
// write actually goes through as the calling user, not the service role.
// This client is built per-request with the caller's own access token
// attached, so `auth.uid()` inside a policy resolves to *them*, not the
// service role — the anon key here is the public, RLS-respecting key
// (NEXT_PUBLIC_SUPABASE_ANON_KEY), not the service-role one.
export function getSupabaseForToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured.');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Verifies the caller is a real, currently signed-in Supabase user — no
// role check (contrast with requireAdmin in lib/adminAuth.ts, which also
// requires app_metadata.role === 'admin'). Returns both the user and a
// client already scoped to their token, ready for an RLS-respecting
// insert/update/delete.
export async function requireUser(request: Request): Promise<{ id: string; email?: string; supabase: ReturnType<typeof getSupabaseForToken> }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    throw new UserAuthError('Sign in to do this.', 401);
  }

  const supabase = getSupabaseForToken(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new UserAuthError('Your session has expired — sign in again.', 401);
  }
  return { id: data.user.id, email: data.user.email ?? undefined, supabase };
}
