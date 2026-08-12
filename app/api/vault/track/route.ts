import type { UpdateQuery } from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultProductDoc } from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

async function buildProductResponse(doc: VaultProductDoc) {
  const admin = getSupabaseAdmin();
  const tracks = await Promise.all(
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
  return {
    id: doc._id.toString(),
    sku: doc.sku,
    drawer: doc.drawer,
    title: doc.title,
    description: doc.description,
    readmeGuide: doc.readmeGuide,
    dateAdded: doc.createdAt.toISOString().slice(0, 10),
    tracks,
  };
}

// Human-facing, PIN-gated single-track operations from the Vault UI's
// Inspect Contents view — separate from the n8n-facing, secret-gated
// PATCH /api/radio/weights, which exists for unattended automation instead.
export async function DELETE(request: Request) {
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('Vault backend is not configured.', { status: 500 });
  }

  let body: { pin?: string; sku?: string; drawer?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (body.pin !== '432') {
    return new Response('Invalid vault key.', { status: 401 });
  }
  const { sku, drawer, filename } = body;
  if (!sku?.trim() || !drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer) || !filename?.trim()) {
    return new Response('sku, drawer, and filename are required.', { status: 400 });
  }

  try {
    await dbConnect();
    const doc = await VaultProduct.findOne({ sku: sku.trim(), drawer: drawer as VaultDrawer });
    if (!doc) {
      return new Response('Pack not found.', { status: 404 });
    }
    const track = doc.tracks.find((t) => t.filename === filename);
    if (!track) {
      return new Response('Track not found in pack.', { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { error: removeError } = await admin.storage.from(VAULT_BUCKET).remove([track.storagePath]);
    if (removeError) throw removeError;

    await VaultProduct.updateOne({ _id: doc._id }, { $pull: { tracks: { filename } } });

    // A pack with zero tracks left is meaningless — remove the card
    // entirely rather than leaving an empty shell behind.
    if (doc.tracks.length === 1) {
      await VaultProduct.deleteOne({ _id: doc._id });
      return Response.json({ product: null, deleted: true });
    }

    const updatedDoc = await VaultProduct.findById(doc._id);
    if (!updatedDoc) {
      return Response.json({ product: null, deleted: true });
    }
    return Response.json({ product: await buildProductResponse(updatedDoc), deleted: false });
  } catch (err) {
    console.error('Vault track delete error:', err);
    const message = err instanceof Error ? err.message : 'Delete failed.';
    return new Response(message, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  let body: { pin?: string; sku?: string; drawer?: string; filename?: string; weight?: number };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (body.pin !== '432') {
    return new Response('Invalid vault key.', { status: 401 });
  }
  const { sku, drawer, filename, weight } = body;
  if (!sku?.trim() || !drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer) || !filename?.trim()) {
    return new Response('sku, drawer, and filename are required.', { status: 400 });
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    return new Response('weight must be a non-negative number.', { status: 400 });
  }

  try {
    await dbConnect();
    const update: UpdateQuery<VaultProductDoc> = { $set: { 'tracks.$[elem].weight': weight } };
    const doc = await VaultProduct.findOneAndUpdate<VaultProductDoc>(
      { sku: sku.trim(), drawer: drawer as VaultDrawer },
      update,
      { new: true, arrayFilters: [{ 'elem.filename': filename }] }
    );
    if (!doc) {
      return new Response('Pack not found.', { status: 404 });
    }
    return Response.json({ product: await buildProductResponse(doc) });
  } catch (err) {
    console.error('Vault track weight update error:', err);
    const message = err instanceof Error ? err.message : 'Update failed.';
    return new Response(message, { status: 500 });
  }
}
