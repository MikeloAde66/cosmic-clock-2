import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import type { VaultProduct as VaultProductShape } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

export async function GET() {
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return Response.json({ products: [] });
  }

  try {
    await dbConnect();
    const docs = await VaultProduct.find().sort({ createdAt: -1 }).lean();

    const admin = getSupabaseAdmin();
    const products: VaultProductShape[] = await Promise.all(
      docs.map(async (doc) => {
        const tracks = await Promise.all(
          doc.tracks.map(async (t) => {
            const { data: signed, error } = await admin.storage
              .from(VAULT_BUCKET)
              .createSignedUrl(t.storagePath, 60 * 60); // 1 hour

            return {
              filename: t.filename,
              // Falls back to a dead marker rather than throwing the whole
              // list out if one track's signed URL can't be generated (e.g.
              // deleted directly from the Supabase dashboard).
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
          priceCents: doc.priceCents,
          isPublished: doc.isPublished,
          tags: doc.tags,
          metadata: doc.metadata,
        };
      })
    );

    return Response.json({ products });
  } catch (err) {
    console.error('Vault list error:', err);
    // Degrade to an empty list rather than a hard failure — the drawers
    // still render (just empty) even if live inventory can't be reached.
    return Response.json({ products: [] });
  }
}
