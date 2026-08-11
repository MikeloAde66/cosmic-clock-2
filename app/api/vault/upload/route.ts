import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { ensureVaultBucket, getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

// Proxies the file through this route rather than issuing the client a
// direct-to-storage signed upload URL — simpler to reason about for what is
// an internal/admin action, not a public-facing upload surface. Revisit with
// a direct-to-storage flow if uploads ever need to bypass this size limit.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

export async function POST(request: Request) {
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured yet.', { status: 500 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('SUPABASE_URL / SUPABASE_KEY are not configured yet.', { status: 500 });
  }

  const form = await request.formData();

  // Matches the same PIN CosmicVaultAuth gates entry with client-side — not
  // real auth (it's a static string, trivially readable in source), just a
  // minimal server-side check so the upload endpoint isn't wide open to
  // anyone who finds the URL. Worth replacing with real Supabase Auth-based
  // authorization if the Vault ever needs to be more than single-operator.
  const pin = form.get('pin');
  if (pin !== '432') {
    return new Response('Invalid vault key.', { status: 401 });
  }

  const file = form.get('file');
  const title = form.get('title');
  const sku = form.get('sku');
  const drawer = form.get('drawer');
  const description = form.get('description') ?? '';
  const readmeGuide = form.get('readmeGuide') ?? '';

  if (!(file instanceof File)) {
    return new Response('file is required.', { status: 400 });
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
  if (file.size > MAX_UPLOAD_BYTES) {
    return new Response(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit.`, { status: 413 });
  }

  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const storagePath = `${drawer}/${sku.trim()}-${Date.now()}-${sanitizedFilename}`;

  try {
    await ensureVaultBucket();
    const admin = getSupabaseAdmin();

    const { error: uploadError } = await admin.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });
    if (uploadError) throw uploadError;

    await dbConnect();
    const doc = await VaultProduct.create({
      sku: sku.trim(),
      drawer: drawer as VaultDrawer,
      title: title.trim(),
      description: String(description),
      storagePath,
      readmeGuide: String(readmeGuide),
    });

    const { data: signed, error: signError } = await admin.storage
      .from(VAULT_BUCKET)
      .createSignedUrl(storagePath, 60 * 60); // 1 hour, matches the download link's expiry in the list route
    if (signError) throw signError;

    return Response.json({
      product: {
        id: doc._id.toString(),
        sku: doc.sku,
        drawer: doc.drawer,
        title: doc.title,
        description: doc.description,
        fileUrl: signed.signedUrl,
        readmeGuide: doc.readmeGuide,
        dateAdded: doc.createdAt.toISOString().slice(0, 10),
        isPlaceholder: false,
      },
    });
  } catch (err) {
    console.error('Vault upload error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return new Response(message, { status: 500 });
  }
}
