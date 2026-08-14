import type { UpdateQuery } from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultProductDoc } from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Records tracks that have ALREADY landed in Supabase Storage — the client
// gets there via POST /api/vault/upload-url (mints a signed upload URL) and
// then uploads straight to Storage from the browser, bypassing this route
// entirely for the actual bytes. This route only ever sees small JSON
// (filenames/paths/sizes), never a file body, so a 100MB+ video is no
// different to it than a 1KB track.
interface FinalizedTrack {
  filename: string;
  storagePath: string;
  sizeBytes: number;
  durationSeconds?: number;
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
  // belonging to an account with app_metadata.role === 'admin'.
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: {
    title?: string;
    sku?: string;
    drawer?: string;
    description?: string;
    readmeGuide?: string;
    priceCents?: number;
    isPublished?: boolean;
    tags?: string[];
    metadata?: Record<string, string | number | boolean>;
    tracks?: FinalizedTrack[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { title, sku, drawer, tracks } = body;
  const description = body.description ?? '';
  const readmeGuide = body.readmeGuide ?? '';
  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  const priceCents =
    typeof body.priceCents === 'number' && Number.isFinite(body.priceCents) ? body.priceCents : undefined;
  const metadata = body.metadata;
  // The ADMIN drawer holds system credentials/backups — never publishable,
  // regardless of what the client sends, so this is re-checked server-side
  // rather than trusted from the body.
  const isPublished = body.isPublished === true && drawer !== 'ADMIN';

  if (typeof title !== 'string' || !title.trim()) {
    return new Response('title is required.', { status: 400 });
  }
  if (typeof sku !== 'string' || !sku.trim()) {
    return new Response('sku is required.', { status: 400 });
  }
  if (typeof drawer !== 'string' || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response(`drawer must be one of: ${VAULT_DRAWERS.join(', ')}`, { status: 400 });
  }
  if (isPublished && (priceCents === undefined || priceCents <= 0)) {
    return new Response('A price is required to publish to the public storefront.', { status: 400 });
  }
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return new Response('At least one uploaded track is required.', { status: 400 });
  }
  for (const t of tracks) {
    if (typeof t?.filename !== 'string' || typeof t?.storagePath !== 'string' || typeof t?.sizeBytes !== 'number') {
      return new Response('Each track needs a filename, storagePath, and sizeBytes.', { status: 400 });
    }
  }

  try {
    await dbConnect();
    const admin = getSupabaseAdmin();

    const newTracks = tracks.map((t) => ({
      filename: t.filename,
      storagePath: t.storagePath,
      sizeBytes: t.sizeBytes,
      ...(t.durationSeconds ? { durationSeconds: t.durationSeconds } : {}),
    }));

    // Upsert: finalizing against the same sku+drawer appends tracks to the
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
        return {
          filename: t.filename,
          fileUrl: error ? '' : signed.signedUrl,
          sizeBytes: t.sizeBytes,
          durationSeconds: t.durationSeconds,
          weight: t.weight ?? 1,
        };
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
    });
  } catch (err) {
    console.error('Vault upload finalize error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save uploaded tracks.';
    return new Response(message, { status: 500 });
  }
}
