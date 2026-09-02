import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';

// A podcast feed can have hundreds of historical episodes — this route is
// for "grab the last several episodes into my catalog," not "sync an
// entire show archive," so results are capped rather than returned in full.
const MAX_ITEMS = 20;

interface FeedItem {
  title?: string;
  description?: string;
  ['itunes:summary']?: string;
  pubDate?: string;
  enclosure?: { url?: string; type?: string };
}

interface ParsedEpisode {
  title: string;
  description: string;
  pubDate: string;
  enclosureUrl: string;
}

function stripHtml(text: unknown): string {
  return typeof text === 'string' ? text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
}

function isValidAudioEnclosure(enclosure: FeedItem['enclosure']): enclosure is { url: string; type?: string } {
  if (!enclosure?.url) return false;
  const type = enclosure.type ?? '';
  return type.startsWith('audio/') || /\.mp3(\?|$)/i.test(enclosure.url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrlParam = searchParams.get('url');

  if (!feedUrlParam) {
    return new Response('Missing "url" query parameter.', { status: 400 });
  }

  let feedUrl: string;
  try {
    feedUrl = new URL(feedUrlParam).toString();
  } catch {
    return new Response('Invalid feed URL.', { status: 400 });
  }

  let xml: string;
  try {
    const res = await fetch(feedUrl);
    if (!res.ok) {
      return new Response(`Could not reach that feed (${res.status}).`, { status: 502 });
    }
    xml = await res.text();
  } catch (err) {
    console.error('Podcast feed fetch failed:', err);
    return new Response('Could not reach that feed.', { status: 502 });
  }

  let data: { rss?: { channel?: { title?: string; item?: FeedItem | FeedItem[] } } };
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    data = parser.parse(xml);
  } catch (err) {
    console.error('Podcast feed XML parse failed:', err);
    return new Response("That URL doesn't look like a valid RSS/podcast feed.", { status: 422 });
  }

  const channel = data?.rss?.channel;
  if (!channel) {
    return new Response("That URL doesn't look like a valid RSS/podcast feed.", { status: 422 });
  }

  const rawItems = channel.item;
  const items: FeedItem[] = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];

  const episodes: ParsedEpisode[] = items
    .filter((item) => isValidAudioEnclosure(item.enclosure))
    .sort((a, b) => new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime())
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      title: stripHtml(item.title) || 'Untitled Episode',
      description: stripHtml(item.description ?? item['itunes:summary']),
      pubDate: item.pubDate ?? '',
      enclosureUrl: item.enclosure!.url!,
    }));

  return Response.json({
    feedTitle: stripHtml(channel.title) || 'Podcast Feed',
    episodes,
  });
}
