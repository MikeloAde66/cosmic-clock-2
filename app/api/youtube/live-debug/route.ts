import { NextResponse } from 'next/server';

// TEMPORARY diagnostics for the live lookup. Removed before merge.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PAGES: Record<string, string> = {
  handleLive: 'https://www.youtube.com/@SkyNews/live',
  handle: 'https://www.youtube.com/@SkyNews',
  channelLive: 'https://www.youtube.com/channel/UCoMdktPbSTixAyNGwb-UYkQ/live',
  embedLive: 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ',
  oembed: 'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2F%40SkyNews%2Flive',
};
const HEADERS: Record<string, Record<string, string>> = {
  full: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': UA, Cookie: 'SOCS=CAI' },
  noCookie: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': UA },
  bare: {},
};

function around(html: string, needle: string, span = 160) {
  const i = html.indexOf(needle);
  return i < 0 ? null : html.slice(Math.max(0, i - 40), i + span);
}

export async function GET() {
  const out: Record<string, unknown> = {};
  for (const [pageName, pageUrl] of Object.entries(PAGES)) {
    for (const [headerName, headers] of Object.entries(HEADERS)) {
      try {
        const res = await fetch(pageUrl, { headers, cache: 'no-store' });
        const html = await res.text();
        out[`${pageName}/${headerName}`] = {
          status: res.status,
          finalUrl: res.url,
          length: html.length,
          title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
          canonical: around(html, 'rel="canonical"'),
          videoDetails: around(html, '"videoDetails"'),
          videoId: around(html, '"videoId"'),
          video_id: around(html, 'video_id'),
          isLiveNow: around(html, '"isLiveNow"', 30),
          externalId: around(html, '"externalId"', 60),
          channelId: around(html, '"channelId"', 60),
          browseId: around(html, '"browseId":"UC', 60),
          head: html.slice(0, 200),
        };
      } catch (e) {
        out[`${pageName}/${headerName}`] = { error: String(e) };
      }
    }
  }
  return NextResponse.json(out);
}
