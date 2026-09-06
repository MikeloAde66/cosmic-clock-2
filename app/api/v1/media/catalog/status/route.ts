// Proxies Media Flow Hub's ON/OFF catalog toggle to the FastAPI backend's
// POST /api/v1/media/catalog/status (routers/media.py) — this is the
// link between a Media Flow catalog item's local active flag and the
// status column GET /api/v1/media/catalog actually filters on, which is
// what determines whether Radio Central's Daily Queue includes it.
// Soft-fails (mirrors the ingest/catalog proxies' convention) when
// MEDIA_CATALOG_STATUS_SERVICE_URL is unset or unreachable.
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (typeof body.url !== 'string' || (body.status !== 'active' && body.status !== 'archived')) {
    return new Response('url (string) and status ("active" | "archived") are required.', { status: 400 });
  }

  const serviceUrl = process.env.MEDIA_CATALOG_STATUS_SERVICE_URL;
  if (!serviceUrl) {
    return Response.json({
      status: 'SKIPPED',
      message: 'MEDIA_CATALOG_STATUS_SERVICE_URL is unset — media backend not wired up yet.',
    });
  }

  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: body.url, status: body.status }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    console.error('Media catalog status proxy failed:', err);
    return Response.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Catalog status update failed.' },
      { status: 502 }
    );
  }
}
