// Serves the live/queued catalog for Media Flow & Audio Center's "Your
// Catalog" section (components/MediaFlowAudioCenter.tsx). There's no real
// Google Sheet or n8n read-workflow wired up yet, so this reads the FastAPI
// backend's own in-memory catalog (routers/media.py's GET /catalog) —
// the "return the active catalog state" fallback. Soft-fails to an empty
// catalog when MEDIA_CATALOG_SERVICE_URL is unset or unreachable.
export const runtime = 'nodejs';

interface MediaMatrixItem {
  id?: string;
  rawTitle: string;
  url: string;
  channel?: string;
  metadata?: { artist?: string; mediaType?: 'audio' | 'video'; [key: string]: unknown };
}

export async function GET() {
  const catalogUrl = process.env.MEDIA_CATALOG_SERVICE_URL;
  if (!catalogUrl) {
    return Response.json({ items: [] });
  }

  try {
    const res = await fetch(catalogUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Media catalog service responded ${res.status}`);
    const data: { items?: MediaMatrixItem[] } | MediaMatrixItem[] = await res.json();
    const rawItems = Array.isArray(data) ? data : data.items ?? [];
    const items = rawItems.map((item) => ({
      id: item.id,
      rawTitle: item.rawTitle,
      url: item.url,
      channel: item.channel,
      artist: item.metadata?.artist,
      mediaType: item.metadata?.mediaType,
      metadata: item.metadata ?? {},
    }));
    return Response.json({ items });
  } catch (err) {
    console.error('Media catalog fetch failed:', err);
    return Response.json({ items: [] });
  }
}
