import type { UpdateQuery } from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultProductDoc } from '@/lib/models/VaultProduct';
import { ensureVaultBucket, getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { mapWithConcurrency } from '@/lib/concurrency';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Proxies files through this route rather than issuing the client
// direct-to-storage signed upload URLs — simpler to reason about for what is
// an internal/admin action, not a public-facing upload surface. Revisit with
// a direct-to-storage flow if uploads ever need to bypass these limits.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB per file
const MAX_BATCH_FILES = 200;
const BATCH_CONCURRENCY = 4;

interface TrackUploadSuccess {
  file: File;
  ok: true;
  track: { filename: string; storagePath: string; sizeBytes: number; durationSeconds?: number };
}
interface TrackUploadFailure {
  file: File;
  ok: false;
  error: string;
}

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured yet.', { status: 500 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('SUPABASE_URL / SUPABASE_KEY are not configured yet.', { status: 500 });
  }

  // The PIN still gates entry to the Vault view client-side; this checks
  // the thing that actually matters server-side — a real Supabase session
  // belonging to an account with app_metadata.role === 'admin'. Unlike the
  // PIN (a static string, trivially readable in source), this can't be
  // bypassed by anyone who just finds the URL. Checked before touching the
  // body so a bad/missing token fails fast with a clean 401/403 rather than
  // a formData parse error on whatever was (or wasn't) sent.
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const form = await request.formData();

  // Folder/batch selects (webkitdirectory) can include OS junk files
  // (.DS_Store, Thumbs.db) — drop dotfiles before they become tracks.
  const files = form.getAll('file').filter((f): f is File => f instanceof File && !f.name.split('/').pop()?.startsWith('.'));
  const title = form.get('title');
  const sku = form.get('sku');
  const drawer = form.get('drawer');
  const description = String(form.get('description') ?? '');
  const readmeGuide = String(form.get('readmeGuide') ?? '');
  const priceCentsRaw = form.get('priceCents');
  const priceCents = typeof priceCentsRaw === 'string' && priceCentsRaw.trim() ? Number(priceCentsRaw) : undefined;
  const tagsRaw = form.get('tags');
  const tags =
    typeof tagsRaw === 'string' && tagsRaw.trim()
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  const metadataRaw = form.get('metadata');
  let metadata: Record<string, string | number | boolean> | undefined;
  if (typeof metadataRaw === 'string' && metadataRaw.trim()) {
    try {
      const parsed: unknown = JSON.parse(metadataRaw);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed) ||
        Object.values(parsed).some((v) => typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')
      ) {
        return new Response('metadata must be a flat JSON object of strings, numbers, or booleans.', { status: 400 });
      }
      metadata = parsed as Record<string, string | number | boolean>;
    } catch {
      return new Response('metadata must be valid JSON.', { status: 400 });
    }
  }
  // The ADMIN drawer holds system credentials/backups — never publishable,
  // regardless of what the client sends, so this is re-checked server-side
  // rather than trusted from the form.
  const isPublished = form.get('isPublished') === 'true' && drawer !== 'ADMIN';

  // Optional: client-probed audio durations, positionally aligned with the
  // `file` entries in the order they were appended (FormData preserves
  // append order, and getAll() returns them in that order).
  let durations: (number | null)[] = [];
  const durationsRaw = form.get('durations');
  if (typeof durationsRaw === 'string') {
    try {
      durations = JSON.parse(durationsRaw);
    } catch {
      // Ignore malformed payloads — duration is a nice-to-have, not required.
    }
  }

  if (files.length === 0) {
    return new Response('At least one file is required.', { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return new Response(`A single batch is limited to ${MAX_BATCH_FILES} files.`, { status: 400 });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return new Response('title is required.', { status: 400 });
  }
  if (typeof sku !== 'string' || !sku.trim()) {
    return new Response('sku is required.', { status: 400 });
  }
  if (typeof drawer !== 'string' || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response(`drawer must be one of: ${VAULT_DRAWERS.join(', ')}`, { status: 400 });
  }
  if (isPublished && (priceCents === undefined || !Number.isFinite(priceCents) || priceCents <= 0)) {
    return new Response('A price is required to publish to the public storefront.', { status: 400 });
  }

  try {
    await ensureVaultBucket();
    await dbConnect();
    const admin = getSupabaseAdmin();

    const outcomes = await mapWithConcurrency(files, BATCH_CONCURRENCY, async (file, index): Promise<TrackUploadSuccess | TrackUploadFailure> => {
      try {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`Exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit.`);
        }

        // Directory-mode file pickers can hand back a name carrying the
        // folder path (e.g. "432Hz Pack/Track 01.mp3") rather than a bare
        // filename — strip to the basename before it's used anywhere.
        const baseName = file.name.split('/').pop() || file.name;
        const sanitizedFilename = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        // Nested under the pack's own sku so every product's files live
        // together in the bucket: drawer/sku/timestamp-filename.
        const storagePath = `${drawer}/${sku.trim()}/${Date.now()}-${sanitizedFilename}`;

        const { error: uploadError } = await admin.storage
          .from(VAULT_BUCKET)
          .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });
        if (uploadError) throw uploadError;

        const durationSeconds = durations[index] ?? undefined;

        return {
          file,
          ok: true,
          track: { filename: baseName, storagePath, sizeBytes: file.size, ...(durationSeconds ? { durationSeconds } : {}) },
        };
      } catch (err) {
        return { file, ok: false, error: err instanceof Error ? err.message : 'Upload failed.' };
      }
    });

    const newTracks = outcomes.filter((o): o is TrackUploadSuccess => o.ok).map((o) => o.track);
    const errors = outcomes
      .filter((o): o is TrackUploadFailure => !o.ok)
      .map((o) => ({ filename: o.file.name, message: o.error }));

    if (newTracks.length === 0) {
      return Response.json({ product: null, errors }, { status: 500 });
    }

    // Upsert: a second upload with the same sku+drawer appends tracks to the
    // existing pack (and refreshes its metadata) instead of spawning a
    // duplicate card.
    const update: UpdateQuery<VaultProductDoc> = {
      $set: {
        title: title.trim(),
        description,
        readmeGuide,
        isPublished,
        tags,
        ...(priceCents !== undefined ? { priceCents } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
      $push: { tracks: { $each: newTracks } },
      $setOnInsert: { createdAt: new Date() },
    };
    const doc = await VaultProduct.findOneAndUpdate<VaultProductDoc>(
      { sku: sku.trim(), drawer: drawer as VaultDrawer },
      update,
      { upsert: true, new: true }
    );
    if (!doc) throw new Error('Failed to upsert vault pack.');

    const trackUrls = await Promise.all(
      doc.tracks.map(async (t) => {
        const { data: signed, error } = await admin.storage.from(VAULT_BUCKET).createSignedUrl(t.storagePath, 60 * 60);
        return { filename: t.filename, fileUrl: error ? '' : signed.signedUrl, sizeBytes: t.sizeBytes, durationSeconds: t.durationSeconds, weight: t.weight ?? 1 };
      })
    );

    return Response.json({
      product: {
        id: doc._id.toString(),
        sku: doc.sku,
        drawer: doc.drawer,
        title: doc.title,
        description: doc.description,
        readmeGuide: doc.readmeGuide,
        dateAdded: doc.createdAt.toISOString().slice(0, 10),
        tracks: trackUrls,
        priceCents: doc.priceCents,
        isPublished: doc.isPublished,
        tags: doc.tags,
        metadata: doc.metadata,
      },
      errors,
    });
  } catch (err) {
    console.error('Vault upload error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return new Response(message, { status: 500 });
  }
}
