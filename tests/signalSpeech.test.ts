// Checks the spoken scripts for Signal. Run with:
//   node --test tests/signalSpeech.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { chunk, dispatchScript, issueScript, listenMinutes, speakable } from '../lib/signal/speech.ts';
import { DISPATCHES } from '../lib/signal/dispatches.ts';

test('written text is made easier to speak', () => {
  assert.equal(speakable('Your 401(k) vs. The Fed'), 'Your 401(k) versus The Fed');
  assert.equal(speakable('a — b'), 'a, b');
  assert.equal(speakable('Trade & Pricing'), 'Trade and Pricing');
});

test('chunks stay short, are never empty, and keep every word', () => {
  for (const d of DISPATCHES) {
    for (const p of d.body) {
      const parts = chunk(p);
      assert.ok(parts.length > 0);
      for (const c of parts) {
        assert.ok(c.length > 0 && c.length <= 230, `chunk length ${c.length}`);
      }
      assert.equal(parts.join(' ').replace(/\s+/g, ' '), speakable(p).replace(/\s+/g, ' '));
    }
  }
});

test('a very long sentence is split at punctuation, not mid-word', () => {
  const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(', ') + '.';
  const parts = chunk(long, 100);
  assert.ok(parts.length > 1);
  for (const c of parts) assert.ok(c.length <= 110);
  assert.equal(parts.join(' '), long);
});

test('every dispatch opens with its headline and is honest about what it is', () => {
  for (const d of DISPATCHES) {
    const script = dispatchScript(d);
    assert.ok(script[0].startsWith(d.headline.replace(/ vs\. /, ' versus ')), script[0]);
    const all = script.join(' ');
    if (d.kind === 'sample') assert.match(all, /sample dispatch.*illustrative/);
    else assert.match(all, /explainer: general background, not a news report/);
  }
});

test('the earnings brief and the tracker read out their items', () => {
  const brief = dispatchScript(DISPATCHES.find((d) => d.id === 'earnings-brief')!).join(' ');
  assert.match(brief, /Number 1, Cloud infrastructure\. Guidance quietly tightened/);
  const tracker = dispatchScript(DISPATCHES.find((d) => d.id === 'supply-chain-watch')!).join(' ');
  assert.match(tracker, /Pacific port dwell times: elevated\./);
  assert.match(tracker, /Ocean freight spot rates: easing\./);
});

test('callouts are read last', () => {
  const d = DISPATCHES.find((x) => x.id === 'tariff-tax')!;
  const script = dispatchScript(d);
  assert.match(script[script.length - 1] + script[script.length - 2], /What to watch\./);
});

test('the issue briefing names every headline and says it is not live news', () => {
  const all = issueScript(DISPATCHES).join(' ');
  for (const d of DISPATCHES) assert.ok(all.includes(d.headline.replace(/ vs\. /, ' versus ')), d.headline);
  assert.match(all, /not live news/);
});

test('listening time is at least a minute and scales with length', () => {
  assert.equal(listenMinutes(['one two three']), 1);
  const long = Array.from({ length: 5 }, () => Array.from({ length: 300 }, () => 'w').join(' '));
  assert.equal(listenMinutes(long), 10);
});

test('a recording\'s length is worked out from its size and bitrate', async () => {
  const { audioFrom, formatSeconds } = await import('../lib/signal/speech.ts');
  const manifest = { a: { bytes: 678599, format: 'mp3_44100_64' }, b: { bytes: 960000, format: 'mp3_44100_128' } };
  assert.deepEqual(audioFrom(manifest, 'a'), { src: '/signal-audio/a.mp3', seconds: 85 });
  assert.equal(audioFrom(manifest, 'b')?.seconds, 60);
  assert.equal(audioFrom(manifest, 'missing'), undefined);
  assert.equal(formatSeconds(85), '1:25');
  assert.equal(formatSeconds(45), '0:45');
});

test('the hub ticker types the tagline then every dispatch, in lines short enough for one row', async () => {
  const { tickerLines, TAGLINE } = await import('../lib/signal/ticker.ts');
  const lines = tickerLines();
  assert.equal(lines.length, TAGLINE.length + DISPATCHES.length);
  assert.equal(TAGLINE.join(' ').replace(/ —/, ' —'), "The numbers behind the news — where the money actually moves, who actually pays, and what's buried on page 47.");
  for (const l of lines) assert.ok(l.length > 0 && l.length <= 110, `${l.length}: ${l}`);
  assert.ok(lines.some((l) => l.startsWith('The Hidden Tariff Tax — ')));
});
