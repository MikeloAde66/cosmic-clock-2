// YouTube live links for Studio One's Broadcast Monitor.
//
// A channel's live link ("youtube.com/@SkyNews/live") carries no video id,
// so the monitor's player has nothing to load. These helpers recognise such
// links and pull the id of the stream currently on air out of YouTube's own
// page for that link. Pure functions, shared by components/PodsModule.tsx
// and app/api/youtube/live/route.ts.

export type LiveChannelTarget =
  | { kind: 'handle'; value: string }
  | { kind: 'channel'; value: string };

const HANDLE = /^[\w.-]{3,30}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;

export function isValidHandle(value: string): boolean {
  return HANDLE.test(value);
}

export function isValidChannelId(value: string): boolean {
  return CHANNEL_ID.test(value);
}

function youtubeUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\.|^m\./, '');
    return host === 'youtube.com' ? url : null;
  } catch {
    return null;
  }
}

// "youtube.com/live/ID" (what Share gives on a live stream) and
// "youtube.com/shorts/ID" both name one specific video.
export function parseYouTubePathVideoId(rawUrl: string): string | null {
  const url = youtubeUrl(rawUrl);
  if (!url) return null;
  const id = url.pathname.match(/^\/(?:live|shorts)\/([\w-]+)/)?.[1];
  return id && VIDEO_ID.test(id) ? id : null;
}

// A link that means "whatever this channel is airing live right now":
//   youtube.com/@Handle/live          youtube.com/@Handle
//   youtube.com/channel/UC…/live      youtube.com/embed/live_stream?channel=UC…
// Returns null for everything else, including links to one specific video.
export function parseYouTubeLiveChannel(rawUrl: string): LiveChannelTarget | null {
  const url = youtubeUrl(rawUrl);
  if (!url) return null;

  if (url.pathname === '/embed/live_stream') {
    const channel = url.searchParams.get('channel') || '';
    return isValidChannelId(channel) ? { kind: 'channel', value: channel } : null;
  }

  const handle = url.pathname.match(/^\/@([^/]+)(?:\/live)?\/?$/)?.[1];
  if (handle) return isValidHandle(handle) ? { kind: 'handle', value: handle } : null;

  const channel = url.pathname.match(/^\/channel\/([^/]+)\/live\/?$/)?.[1];
  if (channel) return isValidChannelId(channel) ? { kind: 'channel', value: channel } : null;

  return null;
}

// The YouTube page that redirects to a channel's current live stream.
export function buildLivePageUrl(target: LiveChannelTarget): string {
  return target.kind === 'handle'
    ? `https://www.youtube.com/@${target.value}/live`
    : `https://www.youtube.com/channel/${target.value}/live`;
}

// When a channel is on air, its /live page is the watch page for that
// stream, and the page's canonical link names the video. When nothing is on
// air the canonical link is the channel itself, so this returns null.
export function extractLiveVideoId(html: string): { videoId: string; isLiveNow: boolean } | null {
  const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  if (!canonical) return null;
  return { videoId: canonical, isLiveNow: /"isLiveNow":true/.test(html) };
}
