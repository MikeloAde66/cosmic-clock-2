import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { VAULT_DRAWERS, type VaultDrawer } from '@/lib/vaultRegistry';
import { isAuthorizedAutomationRequest } from '@/lib/radioAuth';

export const runtime = 'nodejs';

interface WeightUpdate {
  filename: string;
  weight: number;
}

export async function PATCH(request: Request) {
  if (!isAuthorizedAutomationRequest(request)) {
    return new Response('Unauthorized.', { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return new Response('MONGODB_URI is not configured.', { status: 500 });
  }

  let body: { sku?: string; drawer?: string; updates?: WeightUpdate[] };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { sku, drawer, updates } = body;
  if (!sku?.trim()) return new Response('sku is required.', { status: 400 });
  if (!drawer || !VAULT_DRAWERS.includes(drawer as VaultDrawer)) {
    return new Response(`drawer must be one of: ${VAULT_DRAWERS.join(', ')}`, { status: 400 });
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return new Response('updates must be a non-empty array of { filename, weight }.', { status: 400 });
  }
  for (const u of updates) {
    if (!u.filename || typeof u.weight !== 'number' || !Number.isFinite(u.weight) || u.weight < 0) {
      return new Response('Each update needs a filename and a non-negative numeric weight.', { status: 400 });
    }
  }

  try {
    await dbConnect();

    const bulkResult = await VaultProduct.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { sku: sku.trim(), drawer: drawer as VaultDrawer },
          update: { $set: { 'tracks.$[elem].weight': u.weight } },
          arrayFilters: [{ 'elem.filename': u.filename }],
        },
      }))
    );

    if (bulkResult.matchedCount === 0) {
      return new Response(`No pack found for sku=${sku} drawer=${drawer}.`, { status: 404 });
    }

    return Response.json({ matched: bulkResult.matchedCount, modified: bulkResult.modifiedCount });
  } catch (err) {
    console.error('Radio weights update error:', err);
    const message = err instanceof Error ? err.message : 'Weight update failed.';
    return new Response(message, { status: 500 });
  }
}
