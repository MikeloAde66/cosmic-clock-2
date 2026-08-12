import { getSupabaseAdmin } from './supabaseAdmin';

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Verifies the caller is a real, currently-authenticated Supabase user AND
// that their account carries app_metadata.role === 'admin'. app_metadata is
// deliberately used instead of user_metadata: only the service-role key can
// set it (see scripts/grantAdmin — there's no self-service path), so a user
// can never grant themselves admin by editing their own profile client-side.
export async function requireAdmin(request: Request): Promise<{ id: string; email?: string }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    throw new AdminAuthError('Sign in with an admin account to do this.', 401);
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new AdminAuthError('Your session has expired — sign in again.', 401);
  }
  if (data.user.app_metadata?.role !== 'admin') {
    throw new AdminAuthError('Admin access is required for this action.', 403);
  }
  return { id: data.user.id, email: data.user.email ?? undefined };
}
