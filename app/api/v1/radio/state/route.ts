// Lets Radio Central (RadioCentralConsoleView.tsx) poll the backend's
// externally-controllable broadcast state (routers/radio.py's
// GET /api/v1/radio/state) — n8n or any other automation can flip this
// via a direct POST to the FastAPI backend's own /api/v1/radio/toggle,
// bypassing this Next.js route entirely. Soft-fails to both-off when
// MEDIA_RADIO_STATE_SERVICE_URL is unset or unreachable, same convention
// as the media catalog/ingest proxies.
export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.MEDIA_RADIO_STATE_SERVICE_URL;
  if (!url) {
    return Response.json({ daily_queue: false, program_manager: false });
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Radio state service responded ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error('Radio state fetch failed:', err);
    return Response.json({ daily_queue: false, program_manager: false });
  }
}
