import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { ensureVaultBucket, getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { isAuthorizedAutomationRequest } from '@/lib/radioAuth';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB, matches the vault upload route

// Adds and/or removes a track from an ad-rotation pack in one call — built
// for n8n to retire an old ad and drop in its replacement without a human
// going through the Vault upload modal. sku/drawer aren't hardcoded to the
// "Commercials & Ads Loop" station specifically, so this works for any
// ad-style pack, not just the one curated station.
export async function POST(request: Request) {
  if (!isAuthorizedAutomationRequest(request)) {
    return new Response('Unauthorized.', { status: 401 });
  }
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('Vault backend is not configured.', { status: 500 });
  }

  const form = await request.formData();
  const sku = form.get('sku');
  const drawer = form.get('drawer');
  const removeFilename = form.get('removeFilename');
  const file = form.get('file');
  const weightRaw = form.get('weight');

  if (typeof sku !== 'string' || !sku.trim()) {
    return new Response('sku is required.', { status: 400 });
  }
  if (typeof drawer !== 'string' || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response(`drawer must be one of: ${VAULT_DRAWERS.join(', ')}`, { status: 400 });
  }
  const hasRemoval = typeof removeFilename === 'string' && removeFilename.trim().length > 0;
  const hasAddition = file instanceof File;
  if (!hasRemoval && !hasAddition) {
    return new Response('Provide removeFilename and/or file — at least one is required.', { status: 400 });
  }
  if (hasAddition && file.size > MAX_UPLOAD_BYTES) {
    return new Response(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit.`, { status: 413 });
  }

  try {
    await dbConnect();

    if (hasRemoval) {
      await VaultProduct.updateOne({ sku: sku.trim(), drawer: drawer as VaultDrawer }, { $pull: { tracks: { filename: removeFilename.trim() } } });
    }

    if (hasAddition) {
      await ensureVaultBucket();
      const admin = getSupabaseAdmin();

      const baseName = file.name.split('/').pop() || file.name;
      const sanitizedFilename = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const storagePath = `${drawer}/${sku.trim()}/${Date.now()}-${sanitizedFilename}`;

      const { error: uploadError } = await admin.storage
        .from(VAULT_BUCKET)
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw uploadError;

      const weight = typeof weightRaw === 'string' && weightRaw.trim() ? Number(weightRaw) : 1;

      await VaultProduct.updateOne(
        { sku: sku.trim(), drawer: drawer as VaultDrawer },
        { $push: { tracks: { filename: baseName, storagePath, sizeBytes: file.size, weight } } },
        { upsert: true }
      );
    }

    const doc = await VaultProduct.findOne({ sku: sku.trim(), drawer: drawer as VaultDrawer }).lean();
    return Response.json({
      sku: doc?.sku,
      drawer: doc?.drawer,
      trackCount: doc?.tracks.length ?? 0,
      tracks: doc?.tracks.map((t) => ({ filename: t.filename, weight: t.weight ?? 1 })) ?? [],
    });
  } catch (err) {
    console.error('Radio ad swap error:', err);
    const message = err instanceof Error ? err.message : 'Ad swap failed.';
    return new Response(message, { status: 500 });
  }
}
