import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import type { PublishedVaultProduct } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

// Unauthenticated by design — this is the only vault-facing endpoint the
// public storefront calls. It returns just enough to list and buy a pack
// (no storage paths, signed URLs, or readme contents), unlike GET
// /api/vault/list which is the full admin inventory view.
export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ products: [] });
  }

  try {
    await dbConnect();
    const docs = await VaultProduct.find({ isPublished: true, priceCents: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .lean();

    const products: PublishedVaultProduct[] = docs.map((doc) => ({
      id: doc._id.toString(),
      sku: doc.sku,
      drawer: doc.drawer,
      title: doc.title,
      description: doc.description,
      priceCents: doc.priceCents ?? 0,
    }));

    return Response.json({ products });
  } catch (err) {
    console.error('Vault published-list error:', err);
    return Response.json({ products: [] });
  }
}
