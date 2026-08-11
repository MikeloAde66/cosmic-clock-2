import { createClient } from '@supabase/supabase-js';

// Server-only client using the service_role key — bypasses Storage RLS/
// policies, so this must never be imported from client components. It's
// what lets the vault upload API route create the bucket and write files
// without needing per-user storage policies configured in Supabase.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_KEY are not configured — vault uploads are unavailable.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const VAULT_BUCKET = 'vault';

// Idempotent: only hits the network to create the bucket the first time
// it's actually missing.
export async function ensureVaultBucket() {
  const admin = getSupabaseAdmin();
  const { data: existing, error: getError } = await admin.storage.getBucket(VAULT_BUCKET);
  if (existing) return;

  // getBucket errors on "not found" as well as real failures — only treat
  // this as fatal if bucket creation also fails below.
  if (getError) {
    const { error: createError } = await admin.storage.createBucket(VAULT_BUCKET, {
      public: false,
    });
    // Ignore a race where another request created it in between.
    if (createError && !/already exists/i.test(createError.message)) {
      throw createError;
    }
  }
}
