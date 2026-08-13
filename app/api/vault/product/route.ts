import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import {
  VAULT_DRAWERS,
  type VaultDrawer,
  type VaultProductVariant,
  type VaultVariantFulfillmentType,
  type VaultVariantProductType,
} from '@/lib/vaultRegistry';
import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

const VARIANT_PRODUCT_TYPES: VaultVariantProductType[] = [
  'physical_original',
  'limited_print',
  'digital_download',
  'non_exclusive_license',
  'exclusive_license',
  'streaming_only',
];
const VARIANT_FULFILLMENT_TYPES: VaultVariantFulfillmentType[] = ['shipment', 'digital_delivery', 'license_grant'];

function validateVariants(input: unknown): VaultProductVariant[] | null {
  if (!Array.isArray(input)) return null;
  const variants: VaultProductVariant[] = [];
  const seenIds = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null;
    const v = raw as Record<string, unknown>;
    if (
      typeof v.id !== 'string' ||
      !v.id.trim() ||
      seenIds.has(v.id) ||
      typeof v.listingTitle !== 'string' ||
      !v.listingTitle.trim() ||
      typeof v.productType !== 'string' ||
      !VARIANT_PRODUCT_TYPES.includes(v.productType as VaultVariantProductType) ||
      typeof v.fulfillmentType !== 'string' ||
      !VARIANT_FULFILLMENT_TYPES.includes(v.fulfillmentType as VaultVariantFulfillmentType) ||
      typeof v.priceCents !== 'number' ||
      !Number.isFinite(v.priceCents) ||
      v.priceCents <= 0 ||
      (v.inventoryCount !== undefined && (typeof v.inventoryCount !== 'number' || v.inventoryCount < 0))
    ) {
      return null;
    }
    seenIds.add(v.id);
    variants.push({
      id: v.id,
      listingTitle: v.listingTitle.trim(),
      productType: v.productType as VaultVariantProductType,
      fulfillmentType: v.fulfillmentType as VaultVariantFulfillmentType,
      priceCents: v.priceCents,
      inventoryCount: v.inventoryCount as number | undefined,
      isAvailable: v.isAvailable !== false,
    });
  }
  return variants;
}

// Admin-gated: replaces a pack's whole productVariants array (same
// upsert-the-whole-field convention as tags on upload) — lets an admin
// turn one Vault master item into several separately priced/fulfilled
// storefront listings (e.g. a physical original + a digital license from
// the same source) without duplicating the underlying files.
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

  let body: { sku?: string; drawer?: string; productVariants?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { sku, drawer, productVariants: rawVariants } = body;
  if (!sku?.trim() || !drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response('sku and drawer are required.', { status: 400 });
  }
  const productVariants = validateVariants(rawVariants ?? []);
  if (!productVariants) {
    return new Response(
      'productVariants must be an array of { id, listingTitle, productType, fulfillmentType, priceCents, inventoryCount?, isAvailable? } with unique ids.',
      { status: 400 }
    );
  }

  try {
    await dbConnect();
    const doc = await VaultProduct.findOneAndUpdate(
      { sku: sku.trim(), drawer: drawer as VaultDrawer },
      { $set: { productVariants } },
      { new: true }
    );
    if (!doc) {
      return new Response('Pack not found.', { status: 404 });
    }
    return Response.json({ productVariants: doc.productVariants });
  } catch (err) {
    console.error('Vault product variant update error:', err);
    const message = err instanceof Error ? err.message : 'Update failed.';
    return new Response(message, { status: 500 });
  }
}

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
