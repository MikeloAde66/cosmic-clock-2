import dbConnect from '@/lib/dbConnect';
import VaultProduct, { type VaultProductDoc } from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

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

// Admin-gated pack rename — the only way to change a pack's title/description
// after creation. Deliberately separate from PATCH /api/vault/product (which
// only ever replaces productVariants) and PATCH /api/vault/track (which only
// ever edits one track's rotation weight), matching this API's existing
// one-route-per-concern convention.
export async function PATCH(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { sku?: string; drawer?: string; title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { sku, drawer, title, description } = body;
  if (!sku?.trim() || !drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response('sku and drawer are required.', { status: 400 });
  }
  if (title === undefined && description === undefined) {
    return new Response('title and/or description is required.', { status: 400 });
  }
  if (title !== undefined && !title.trim()) {
    return new Response('title cannot be blank.', { status: 400 });
  }

  const $set: Record<string, string> = {};
  if (title !== undefined) $set.title = title.trim();
  if (description !== undefined) $set.description = description.trim();

  try {
    await dbConnect();
    const doc = await VaultProduct.findOneAndUpdate<VaultProductDoc>(
      { sku: sku.trim(), drawer: drawer as VaultDrawer },
      { $set },
      { new: true }
    );
    if (!doc) {
      return new Response('Pack not found.', { status: 404 });
    }
    return Response.json({ product: await buildProductResponse(doc) });
  } catch (err) {
    console.error('Vault pack metadata update error:', err);
    const message = err instanceof Error ? err.message : 'Update failed.';
    return new Response(message, { status: 500 });
  }
}
