import { supabase } from '@/lib/supabase';
import { mapWithConcurrency } from '@/lib/concurrency';
import type { VaultDrawer } from '@/lib/vaultRegistry';

export interface DirectUploadTrack {
  filename: string;
  storagePath: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export interface DirectUploadFailure {
  filename: string;
  message: string;
}

export interface DirectUploadResult {
  tracks: DirectUploadTrack[];
  failures: DirectUploadFailure[];
}

type SignOutcome =
  | { index: number; filename: string; ok: true; storagePath: string; token: string; signedUrl: string }
  | { index: number; filename: string; ok: false; error: string };

const UPLOAD_CONCURRENCY = 4;

// Uploads `files` straight from the browser to Supabase Storage via signed
// URLs minted by POST /api/vault/upload-url, bypassing this app's own
// serverless function body entirely — the only way a 100MB+ video reaches
// Storage without hitting a platform request-size limit on the proxy route
// this replaced. Returns metadata for whichever files made it through, plus
// a per-file failure for the rest, so a caller can finalize a partial batch.
export async function uploadFilesDirectToStorage(
  files: File[],
  drawer: VaultDrawer,
  sku: string,
  durations: Map<File, number>,
  authHeader: HeadersInit
): Promise<DirectUploadResult> {
  if (files.length === 0) return { tracks: [], failures: [] };

  const signRes = await fetch('/api/vault/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      drawer,
      sku,
      files: files.map((f) => ({ filename: f.name, sizeBytes: f.size })),
    }),
  });
  if (!signRes.ok) {
    const message = await signRes.text();
    return {
      tracks: [],
      failures: files.map((f) => ({ filename: f.name, message: message || `Failed to prepare upload (${signRes.status}).` })),
    };
  }

  const signData: { bucket: string; uploads: SignOutcome[] } = await signRes.json();
  const tracks: DirectUploadTrack[] = [];
  const failures: DirectUploadFailure[] = [];

  await mapWithConcurrency(signData.uploads, UPLOAD_CONCURRENCY, async (entry) => {
    if (!entry.ok) {
      failures.push({ filename: entry.filename, message: entry.error });
      return;
    }
    const file = files[entry.index];
    const { error } = await supabase.storage.from(signData.bucket).uploadToSignedUrl(entry.storagePath, entry.token, file);
    if (error) {
      failures.push({ filename: entry.filename, message: error.message });
      return;
    }
    tracks.push({
      filename: entry.filename,
      storagePath: entry.storagePath,
      sizeBytes: file.size,
      durationSeconds: durations.get(file),
    });
  });

  return { tracks, failures };
}
