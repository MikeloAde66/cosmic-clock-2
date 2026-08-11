import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import { getSupabaseAdmin, VAULT_BUCKET } from '@/lib/supabaseAdmin';
import { mapWithConcurrency } from '@/lib/concurrency';
import { isAuthorizedAutomationRequest } from '@/lib/radioAuth';

export const runtime = 'nodejs';

interface BrokenLink {
  sku: string;
  drawer: string;
  filename: string;
  storagePath: string;
  error: string;
}

export async function GET(request: Request) {
  if (!isAuthorizedAutomationRequest(request)) {
    return new Response('Unauthorized.', { status: 401 });
  }
  if (!process.env.MONGODB_URI || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return new Response('Vault backend is not configured.', { status: 500 });
  }

  try {
    await dbConnect();
    const docs = await VaultProduct.find().lean();
    const admin = getSupabaseAdmin();

    const checks = docs.flatMap((doc) =>
      doc.tracks.map((t) => ({ sku: doc.sku, drawer: doc.drawer, filename: t.filename, storagePath: t.storagePath }))
    );

    const broken: BrokenLink[] = [];
    await mapWithConcurrency(checks, 8, async (check) => {
      const { error } = await admin.storage.from(VAULT_BUCKET).createSignedUrl(check.storagePath, 60);
      if (error) broken.push({ ...check, error: error.message });
    });

    return Response.json({
      packCount: docs.length,
      trackCount: checks.length,
      brokenLinkCount: broken.length,
      brokenLinks: broken,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Vault health check error:', err);
    const message = err instanceof Error ? err.message : 'Health check failed.';
    return new Response(message, { status: 500 });
  }
}
