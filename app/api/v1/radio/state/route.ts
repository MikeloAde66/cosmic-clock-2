// Lets Radio Central (RadioCentralConsoleView.tsx) poll the backend's
// externally-controllable broadcast state (routers/radio.py's
// GET /api/v1/radio/state) — n8n, the owner's own toggle clicks (see
// app/api/v1/radio/toggle/route.ts), or any other automation can flip this.
// Soft-fails to both-off when MEDIA_RADIO_STATE_SERVICE_URL is unset or
// unreachable, same convention as the media catalog/ingest proxies.
//
// MUST be dynamic, not force-static: this endpoint's whole job is to
// report the CURRENT, frequently-changing value of program_manager/
// daily_queue. force-static (previously set here) made Next.js serve this
// route as a frozen snapshot from whenever it first built/was hit after a
// deploy — every 20s poll kept reading that one frozen response forever,
// no matter how many real writes landed in the radio_state table
// afterward (a toggle button, a manual channel pick, or the toggle route),
// which looked exactly like "it has a delay and then reverts on its own."
// cache: 'no-store' on the inner fetch is the same fix one layer down —
// Next.js's extended fetch() memoizes/caches by default even in a dynamic
// route unless told not to.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export async function GET() {
  const url = process.env.MEDIA_RADIO_STATE_SERVICE_URL;
  if (!url) {
    return Response.json({ daily_queue: false, program_manager: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Radio state service responded ${res.status}`);
    const data = await res.json();
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Radio state fetch failed:', err);
    return Response.json({ daily_queue: false, program_manager: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
