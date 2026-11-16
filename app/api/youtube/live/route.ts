import { NextResponse } from 'next/server';
import { buildLivePageUrl, extractLiveVideoId, isValidChannelId, isValidHandle, type LiveChannelTarget } from '@/lib/youtubeLive';

// GET /api/youtube/live?handle=SkyNews   or   ?channel=UC…
//
// Finds the video id of the stream a YouTube channel is airing right now,
// for Studio One's Broadcast Monitor (components/PodsModule.tsx). It reads
// YouTube's own public "/live" page for the channel — no API key. Only a
// validated handle or channel id is ever put into the address, so this
// cannot be pointed at any other site.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle') || '';
  const channel = searchParams.get('channel') || '';

  let target: LiveChannelTarget | null = null;
  if (isValidHandle(handle)) target = { kind: 'handle', value: handle };
  else if (isValidChannelId(channel)) target = { kind: 'channel', value: channel };
  if (!target) {
    return NextResponse.json({ error: 'That is not a YouTube channel link.' }, { status: 400 });
  }

  try {
    const res = await fetch(buildLivePageUrl(target), {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        // Skips the cookie-consent page YouTube shows to some regions.
        Cookie: 'SOCS=CAI',
      },
      // A live stream's id can change when the broadcaster restarts it, so
      // keep an answer for a minute at most.
      next: { revalidate: 60 },
    });
    if (res.status === 404) {
      return NextResponse.json({ error: 'YouTube has no channel at that link.' }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `YouTube did not answer (${res.status}).` }, { status: 502 });
    }

    const live = extractLiveVideoId(await res.text());
    if (!live) {
      return NextResponse.json({ error: 'That channel is not live right now.' }, { status: 404 });
    }
    return NextResponse.json(live);
  } catch {
    return NextResponse.json({ error: 'Could not reach YouTube.' }, { status: 502 });
  }
}
