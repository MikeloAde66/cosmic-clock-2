import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { SEED_VAULT_INVENTORY, type VaultProduct as VaultProductShape } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

export async function GET() {
  // Seed rows always render, even with no backend configured yet — they're
  // static and don't need Mongo/Supabase to display.
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return Response.json({ products: SEED_VAULT_INVENTORY });
  }

  try {
    await dbConnect();
    const docs = await VaultProduct.find().sort({ createdAt: -1 }).lean();

    const admin = getSupabaseAdmin();
    const uploaded: VaultProductShape[] = await Promise.all(
      docs.map(async (doc) => {
        const { data: signed, error } = await admin.storage
          .from(VAULT_BUCKET)
          .createSignedUrl(doc.storagePath, 60 * 60); // 1 hour

        return {
          id: doc._id.toString(),
          sku: doc.sku,
          drawer: doc.drawer,
          title: doc.title,
          description: doc.description,
          // Falls back to a dead marker rather than throwing the whole list
          // out if one file's signed URL can't be generated (e.g. deleted
          // directly from the Supabase dashboard).
          fileUrl: error ? '' : signed.signedUrl,
          readmeGuide: doc.readmeGuide,
          dateAdded: doc.createdAt.toISOString().slice(0, 10),
          isPlaceholder: false,
        };
      })
    );

    return Response.json({ products: [...uploaded, ...SEED_VAULT_INVENTORY] });
  } catch (err) {
    console.error('Vault list error:', err);
    // Degrade to seed-only rather than a hard failure — the drawers still
    // render something even if the live inventory can't be reached.
    return Response.json({ products: SEED_VAULT_INVENTORY });
  }
}
