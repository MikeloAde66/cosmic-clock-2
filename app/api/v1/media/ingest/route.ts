// Proxies media-ingest submissions from Media Flow & Audio Center
// (components/MediaFlowAudioCenter.tsx) to the FastAPI backend's
// /api/v1/media/ingest (main.py + routers/media.py), which forwards to
// n8n via services/n8n_client.py. Soft-fails when unset so a missing
// backend never blocks the user's local catalog. MEDIA_INGEST_SERVICE_URL
// is the full endpoint URL (not just an origin) — no path is appended here.
export const runtime = 'nodejs';

interface MediaIngestPayload {
  rawTitle: string;
  url: string;
  channel: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (typeof body.rawTitle !== 'string' || typeof body.url !== 'string' || typeof body.channel !== 'string') {
    return new Response('rawTitle, url, and channel are required strings.', { status: 400 });
  }

  const payload: MediaIngestPayload = {
    rawTitle: body.rawTitle,
    url: body.url,
    channel: body.channel,
    metadata:
      typeof body.metadata === 'object' && body.metadata !== null
        ? (body.metadata as Record<string, unknown>)
        : undefined,
  };

  const serviceUrl = process.env.MEDIA_INGEST_SERVICE_URL;
  if (!serviceUrl) {
    return Response.json({
      status: 'SKIPPED',
      message: 'MEDIA_INGEST_SERVICE_URL is unset — media backend not wired up yet.',
    });
  }

  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.MEDIA_INGEST_SERVICE_API_KEY
          ? { 'X-API-Key': process.env.MEDIA_INGEST_SERVICE_API_KEY }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    console.error('Media ingest proxy failed:', err);
    return Response.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Media ingest request failed.' },
      { status: 502 }
    );
  }
}
