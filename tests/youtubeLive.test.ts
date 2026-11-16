// Checks the YouTube live-link helpers for Studio One. Run with:
//   node --test tests/youtubeLive.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLivePageUrl,
  extractLiveVideoId,
  parseYouTubeLiveChannel,
  parseYouTubePathVideoId,
} from '../lib/youtubeLive.ts';

test('channel live links are recognised', () => {
  assert.deepEqual(parseYouTubeLiveChannel('https://www.youtube.com/@SkyNews/live'), { kind: 'handle', value: 'SkyNews' });
  assert.deepEqual(parseYouTubeLiveChannel('https://youtube.com/@France24_en/live/'), { kind: 'handle', value: 'France24_en' });
  assert.deepEqual(parseYouTubeLiveChannel('https://m.youtube.com/@dwnews'), { kind: 'handle', value: 'dwnews' });
  assert.deepEqual(parseYouTubeLiveChannel('https://www.youtube.com/channel/UCoMdktPbSTixAyNGwb-UYkQ/live'), {
    kind: 'channel',
    value: 'UCoMdktPbSTixAyNGwb-UYkQ',
  });
  assert.deepEqual(parseYouTubeLiveChannel('https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg'), {
    kind: 'channel',
    value: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
  });
});

test('links to one video, other sites and junk are not channel live links', () => {
  for (const url of [
    'https://youtu.be/JXOnhzoC-i8?is=Bg9k7fz-NpG7HbXb',
    'https://www.youtube.com/watch?v=JXOnhzoC-i8',
    'https://www.youtube.com/embed/JXOnhzoC-i8',
    'https://www.youtube.com/live/JXOnhzoC-i8',
    'https://www.youtube.com/playlist?list=PLabc',
    'https://www.youtube.com/@SkyNews/videos',
    'https://www.youtube.com/embed/live_stream?channel=../../evil',
    'https://www.youtube.com/@a/live',
    'https://archive.org/details/BBCNEWS_20261116_000000_BBC_News',
    'https://evil.example/@SkyNews/live',
    'rosen',
    '',
  ]) {
    assert.equal(parseYouTubeLiveChannel(url), null, url);
  }
});

test('live and shorts share links name their video', () => {
  assert.equal(parseYouTubePathVideoId('https://www.youtube.com/live/JXOnhzoC-i8?si=abc'), 'JXOnhzoC-i8');
  assert.equal(parseYouTubePathVideoId('https://youtube.com/shorts/JXOnhzoC-i8'), 'JXOnhzoC-i8');
  assert.equal(parseYouTubePathVideoId('https://www.youtube.com/@SkyNews/live'), null);
  assert.equal(parseYouTubePathVideoId('https://www.youtube.com/live/short'), null);
  assert.equal(parseYouTubePathVideoId('https://www.youtube.com/watch?v=JXOnhzoC-i8'), null);
});

test('the page to read is built from the validated target only', () => {
  assert.equal(buildLivePageUrl({ kind: 'handle', value: 'SkyNews' }), 'https://www.youtube.com/@SkyNews/live');
  assert.equal(
    buildLivePageUrl({ kind: 'channel', value: 'UCoMdktPbSTixAyNGwb-UYkQ' }),
    'https://www.youtube.com/channel/UCoMdktPbSTixAyNGwb-UYkQ/live',
  );
});

test('the stream on air is read from the page, and an off-air channel gives nothing', () => {
  const onAir =
    '<head><link rel="canonical" href="https://www.youtube.com/watch?v=YDvsBbKfLPA"></head><script>{"isLiveNow":true}</script>';
  assert.deepEqual(extractLiveVideoId(onAir), { videoId: 'YDvsBbKfLPA', isLiveNow: true });

  const scheduled = '<link rel="canonical" href="https://www.youtube.com/watch?v=YDvsBbKfLPA">{"isLiveNow":false}';
  assert.deepEqual(extractLiveVideoId(scheduled), { videoId: 'YDvsBbKfLPA', isLiveNow: false });

  // What YouTube sends a server: a blank canonical link, the stream in the page data.
  const toServer =
    '<link rel="canonical" href="undefined">{"currentVideoEndpoint":{"clickTrackingParams":"CAAQ","commandMetadata":{"webCommandMetadata":{"url":"/watch?v=umLWFz4izTM","webPageType":"WEB_PAGE_TYPE_WATCH"}}},"autoplayVideo":{"url":"/watch?v=GC0dAsRl0ao"},"isLive":true}';
  assert.deepEqual(extractLiveVideoId(toServer), { videoId: 'umLWFz4izTM', isLiveNow: true });

  const offAir = '<link rel="canonical" href="https://www.youtube.com/channel/UCoMdktPbSTixAyNGwb-UYkQ">';
  assert.equal(extractLiveVideoId(offAir), null);
});
