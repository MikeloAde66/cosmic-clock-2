import { ensureVaultBucket, getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { mapWithConcurrency } from '@/lib/concurrency';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Mints one Supabase Storage signed upload URL per requested file so the
// browser can PUT bytes straight to Storage afterward — this route (and the
// finalize call to POST /api/vault/upload that follows it) never touches
// file bytes, so neither is bound by a serverless function's request body
// size limit the way the old single-request proxy upload was.
const MAX_BATCH_FILES = 200;
const SIGN_CONCURRENCY = 6;

interface RequestedFile {
  filename: string;
  sizeBytes: number;
}

type SignOutcome =
  | { index: number; filename: string; ok: true; storagePath: string; token: string; signedUrl: string }
  | { index: number; filename: string; ok: false; error: string };

export async function POST(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('SUPABASE_URL / SUPABASE_KEY are not configured yet.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { drawer?: string; sku?: string; files?: RequestedFile[] };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { drawer, sku, files } = body;
  if (typeof sku !== 'string' || !sku.trim()) {
    return new Response('sku is required.', { status: 400 });
  }
  if (typeof drawer !== 'string' || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response(`drawer must be one of: ${VAULT_DRAWERS.join(', ')}`, { status: 400 });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return new Response('At least one file is required.', { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return new Response(`A single batch is limited to ${MAX_BATCH_FILES} files.`, { status: 400 });
  }
  for (const f of files) {
    if (typeof f?.filename !== 'string' || !f.filename.trim() || typeof f.sizeBytes !== 'number') {
      return new Response('Each file needs a filename and sizeBytes.', { status: 400 });
    }
  }

  try {
    await ensureVaultBucket();
    const admin = getSupabaseAdmin();

    const uploads = await mapWithConcurrency<RequestedFile, SignOutcome>(files, SIGN_CONCURRENCY, async (file, index) => {
      // Directory-mode pickers can hand back a name carrying the folder path
      // — strip to the basename, same as the old proxied route did.
      const baseName = file.filename.split('/').pop() || file.filename;
      const sanitizedFilename = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      // Index included alongside the timestamp so two files requested in the
      // same millisecond (a real possibility once signing several at once)
      // never collide on the same storage path.
      const storagePath = `${drawer}/${sku.trim()}/${Date.now()}-${index}-${sanitizedFilename}`;

      const { data, error } = await admin.storage.from(VAULT_BUCKET).createSignedUploadUrl(storagePath);
      if (error || !data) {
        return { index, filename: file.filename, ok: false, error: error?.message ?? 'Failed to create signed upload URL.' };
      }
      return { index, filename: file.filename, ok: true, storagePath: data.path, token: data.token, signedUrl: data.signedUrl };
    });

    return Response.json({ bucket: VAULT_BUCKET, uploads });
  } catch (err) {
    console.error('Vault upload-url error:', err);
    const message = err instanceof Error ? err.message : 'Failed to prepare uploads.';
    return new Response(message, { status: 500 });
  }
}
