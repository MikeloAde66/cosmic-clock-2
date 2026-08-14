import { requireAdmin, AdminAuthError } from '@/lib/adminAuth';

export const runtime = 'nodejs';

// canva.link short URLs redirect to the normal (non-embed) canva.com design
// page, which sets X-Frame-Options: SAMEORIGIN — so putting a short link
// directly in an iframe's src gets blocked. This follows the redirect
// server-side (a browser fetch() can't read res.url across origins without
// CORS, which canva.link doesn't grant) and hands back the resolved
// long-form URL for the client to turn into an embeddable one.
//
// Hostname allowlist only (canva.link / canva.com), https only — this route
// fetches whatever URL it's given, so without the allowlist it would be an
// open SSRF proxy.
const ALLOWED_HOSTS = ['canva.link', 'canva.com', 'www.canva.com'];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    if (err instanceof AdminAuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) {
    return new Response('url query param is required.', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('url must be a valid URL.', { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response('Only https://canva.link or https://canva.com URLs are accepted.', { status: 400 });
  }

  try {
    // GET rather than HEAD — not every redirect service honors HEAD the
    // same way it honors GET, and this is a one-off admin action, not a hot
    // path worth optimizing. res.url is the final URL after every hop.
    const res = await fetch(parsed.toString(), { method: 'GET', redirect: 'follow' });
    return Response.json({ resolvedUrl: res.url });
  } catch (err) {
    console.error('Canva link resolution error:', err);
    const message = err instanceof Error ? err.message : 'Failed to resolve link.';
    return new Response(message, { status: 502 });
  }
}
