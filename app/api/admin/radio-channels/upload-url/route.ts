import dbConnect from '@/lib/dbConnect';
import RadioChannelFolder from '@/lib/models/RadioChannelFolder';
import { ensureRadioChannelsBucket, getSupabaseAdmin, RADIO_CHANNELS_BUCKET } from '@/lib/supabaseAdmin';
import { mapWithConcurrency } from '@/lib/concurrency';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Mirrors app/api/vault/upload-url/route.ts exactly: mints one Supabase
// Storage signed upload URL per requested file so the browser can PUT
// bytes straight to Storage, keeping both this route and the finalize call
// (POST /api/admin/radio-channels/upload) clear of any serverless request
// body size limit — same reason bulk uploads need this two-step shape.
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
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('SUPABASE_URL / SUPABASE_KEY are not configured yet.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { folderId?: string; files?: RequestedFile[] };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { folderId, files } = body;
  if (typeof folderId !== 'string' || !folderId.trim()) {
    return new Response('folderId is required.', { status: 400 });
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
    await dbConnect();
    const folder = await RadioChannelFolder.findById(folderId.trim()).lean();
    if (!folder) return new Response('Folder not found.', { status: 404 });

    await ensureRadioChannelsBucket();
    const admin = getSupabaseAdmin();

    const uploads = await mapWithConcurrency<RequestedFile, SignOutcome>(files, SIGN_CONCURRENCY, async (file, index) => {
      const baseName = file.filename.split('/').pop() || file.filename;
      const sanitizedFilename = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const storagePath = `${folderId.trim()}/${Date.now()}-${index}-${sanitizedFilename}`;

      const { data, error } = await admin.storage.from(RADIO_CHANNELS_BUCKET).createSignedUploadUrl(storagePath);
      if (error || !data) {
        return { index, filename: file.filename, ok: false, error: error?.message ?? 'Failed to create signed upload URL.' };
      }
      return { index, filename: file.filename, ok: true, storagePath: data.path, token: data.token, signedUrl: data.signedUrl };
    });

    return Response.json({ bucket: RADIO_CHANNELS_BUCKET, uploads });
  } catch (err) {
    console.error('Radio channel upload-url error:', err);
    const message = err instanceof Error ? err.message : 'Failed to prepare uploads.';
    return new Response(message, { status: 500 });
  }
}
