import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import type { PublishedVaultProduct } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

// Unauthenticated by design — this is the only vault-facing endpoint the
// public storefront calls. It returns just enough to list and buy a pack
// (no storage paths, signed URLs, or readme contents), unlike GET
// /api/vault/list which is the full admin inventory view.
//
// A pack sells either as one listing (legacy isPublished + priceCents) or
// as several (productVariants, each with its own price/fulfillment) — never
// both; variants, when present, take over entirely for that pack.
export async function GET() {
  if (!process.env.MONGODB_URI) {
    return Response.json({ products: [] });
  }

  try {
    await dbConnect();
    const docs = await VaultProduct.find({
      $or: [{ isPublished: true, priceCents: { $gt: 0 } }, { 'productVariants.isAvailable': true }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const products: PublishedVaultProduct[] = [];
    for (const doc of docs) {
      const availableVariants = (doc.productVariants ?? []).filter((v) => v.isAvailable);
      if (availableVariants.length > 0) {
        for (const variant of availableVariants) {
          // Extends the legacy "vault:{drawer}:{sku}" id with a variant
          // segment — resolveCheckoutItem (app/actions/purchase.ts) parses
          // both forms the same way, just checking for the extra part.
          products.push({
            id: `vault:${doc.drawer}:${doc.sku}:${variant.id}`,
            sku: doc.sku,
            drawer: doc.drawer,
            title: variant.listingTitle,
            description: doc.description,
            priceCents: variant.priceCents,
            variantId: variant.id,
            productType: variant.productType,
            fulfillmentType: variant.fulfillmentType,
          });
        }
      } else if (doc.isPublished && doc.priceCents && doc.priceCents > 0) {
        products.push({
          id: `vault:${doc.drawer}:${doc.sku}`,
          sku: doc.sku,
          drawer: doc.drawer,
          title: doc.title,
          description: doc.description,
          priceCents: doc.priceCents,
        });
      }
    }

    return Response.json({ products });
  } catch (err) {
    console.error('Vault published-list error:', err);
    return Response.json({ products: [] });
  }
}
