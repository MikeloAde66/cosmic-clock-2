import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Writes directly to the same Supabase `radio_state` table the FastAPI
// backend's GET /api/v1/radio/state (routers/radio.py, proxied for the
// frontend via app/api/v1/radio/state/route.ts) already reads from — this
// is the missing write side of that loop. Before this route existed, the
// Program Manager / Daily Queue buttons in RadioCentralConsoleView only
// ever changed LOCAL React state (RadioPlayerContext's
// programManagerEnabled/dailyQueueEnabled); nothing ever persisted that
// change back to `radio_state`. RadioCentralConsoleView's own 20-second
// reconcile poll treats the DB row as authoritative, so a manual click
// would get silently reverted on the very next poll — the DB still said
// whatever it said before the click. That's the "Program Manager keeps
// bypassing it and going back to queue" bug: the toggle worked locally for
// up to 20 seconds, then the unreconciled poll stomped it back.
//
// Writes here directly (via the service-role client), rather than
// round-tripping through the separate FastAPI service like the GET route
// does, since no MEDIA_RADIO_TOGGLE_SERVICE_URL equivalent exists/is
// configured, and this app already has a direct, admin-privileged Supabase
// client (lib/supabaseAdmin.ts) used by the vault routes — no new service
// or env var needed. Both read and write paths end up at the exact same
// table/columns FastAPI's own POST /api/v1/radio/toggle uses.
export const runtime = 'nodejs';

const VALID_KEYS = ['daily_queue', 'program_manager'] as const;
type RadioStateKey = (typeof VALID_KEYS)[number];

export async function POST(request: Request) {
  let body: { key?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { key, enabled } = body;
  if (!key || !VALID_KEYS.includes(key as RadioStateKey) || typeof enabled !== 'boolean') {
    return new Response(`key must be one of: ${VALID_KEYS.join(', ')}, and enabled must be a boolean.`, {
      status: 400,
    });
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('radio_state').upsert({ key, enabled });
    if (error) throw error;
    return Response.json({ status: 'ok', key, enabled });
  } catch (err) {
    console.error('Radio state toggle failed:', err);
    return Response.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Failed to persist radio state.' },
      { status: 502 }
    );
  }
}
