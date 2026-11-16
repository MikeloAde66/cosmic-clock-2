import { NextResponse } from 'next/server';

// TEMPORARY diagnostics for the live lookup. Removed before merge.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function around(html: string, needle: string, span = 220) {
  const i = html.indexOf(needle);
  return i < 0 ? null : html.slice(Math.max(0, i - 30), i + span);
}

async function probe(pageUrl: string) {
  const res = await fetch(pageUrl, { headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': UA, Cookie: 'SOCS=CAI' }, cache: 'no-store' });
  const html = await res.text();
  const counts: Record<string, number> = {};
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const markers = ['"currentVideoEndpoint"', '"updatedMetadataEndpoint"', '"isLive":true', '"isLiveNow":true', 'og:url', 'og:video:url', '"liveChatRenderer"', '"videoPrimaryInfoRenderer"', 'ytInitialPlayerResponse', '"playabilityStatus"', '"topicChannelDetails"', '"watching now"', 'watching', '"isLiveContent"', '"viewCount":{"videoViewCountRenderer"', '"twoColumnWatchNextResults"', '"playlistPanel', '"autoplayVideo"', '"iosAppArguments"', 'vnd.youtube://'];
  const found: Record<string, string | null> = {};
  for (const m of markers) found[m] = around(html, m);
  return { status: res.status, length: html.length, top, found };
}

export async function GET() {
  const out: Record<string, unknown> = {};
  for (const url of ['https://www.youtube.com/@SkyNews/live', 'https://www.youtube.com/@aljazeeraenglish/live']) {
    try {
      out[url] = await probe(url);
    } catch (e) {
      out[url] = { error: String(e) };
    }
  }
  return NextResponse.json(out);
}
