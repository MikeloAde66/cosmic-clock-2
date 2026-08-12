import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// Human-facing, admin-gated whole-pack deletion from a Vault card's corner
// button — removes every track's storage object plus the Mongo record.
export async function DELETE(request: Request) {
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('Vault backend is not configured.', { status: 500 });
  }

  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  let body: { sku?: string; drawer?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { sku, drawer } = body;
  if (!sku?.trim() || !drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response('sku and drawer are required.', { status: 400 });
  }

  try {
    await dbConnect();
    const doc = await VaultProduct.findOne({ sku: sku.trim(), drawer: drawer as VaultDrawer });
    if (!doc) {
      return new Response('Pack not found.', { status: 404 });
    }

    if (doc.tracks.length > 0) {
      const admin = getSupabaseAdmin();
      const { error: removeError } = await admin.storage
        .from(VAULT_BUCKET)
        .remove(doc.tracks.map((t) => t.storagePath));
      if (removeError) throw removeError;
    }

    await VaultProduct.deleteOne({ _id: doc._id });
    return Response.json({ deleted: true, sku: doc.sku, drawer: doc.drawer });
  } catch (err) {
    console.error('Vault product delete error:', err);
    const message = err instanceof Error ? err.message : 'Delete failed.';
    return new Response(message, { status: 500 });
  }
}
