import { SKY_SURVEYS, type SkySurveyId } from '@/lib/starTrackerPro/skySurveys';

export const runtime = 'nodejs';

// Proxies a real NASA full-sky survey texture server-side — see
// lib/starTrackerPro/skySurveys.ts for why: neither real source sets a
// permissive Access-Control-Allow-Origin, so the browser's own WebGL
// texture upload would fail cross-origin no matter how the <img>/loader
// is configured. Fetching here (no CORS enforcement server-to-server) and
// re-serving from this app's own origin is the real, legitimate fix — the
// same pattern this app's SkyView Deep Sky Spectrum integration already
// established, not a new technique invented for this route.
export async function GET(_request: Request, { params }: { params: Promise<{ survey: string }> }) {
  const { survey } = await params;
  const definition = SKY_SURVEYS[survey as SkySurveyId];
  if (!definition || !definition.available || !definition.sourceUrl) {
    return new Response('Unknown or unavailable survey.', { status: 404 });
  }

  try {
    const res = await fetch(definition.sourceUrl, { cache: 'force-cache' });
    if (!res.ok) return new Response('Upstream survey source unavailable.', { status: 502 });
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const body = await res.arrayBuffer();
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        // Real, static NASA outreach imagery — safe to cache aggressively
        // rather than re-fetch multiple megabytes on every visitor.
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err) {
    console.error(`Sky survey proxy failed for ${survey}:`, err);
    return new Response('Upstream survey source unavailable.', { status: 502 });
  }
}
