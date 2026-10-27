// Generates the spoken audio for Signal with ElevenLabs, once, ahead of time.
// The site then plays plain mp3 files and never calls ElevenLabs, so no key is
// needed in production and nobody can run up a bill through the site.
//
//   ELEVENLABS_API_KEY=sk_... node --no-warnings scripts/generate-signal-audio.mjs
//
// Optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL, FORCE=1 to regenerate everything.
// An item whose text, voice and model are unchanged is skipped, so re-running
// costs nothing. The key is read from the environment only; never commit it.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISPATCHES } from '../lib/signal/dispatches.ts';
import { dispatchScript, issueScript } from '../lib/signal/speech.ts';

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('Set ELEVENLABS_API_KEY in the environment.');
  process.exit(1);
}
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'SAz9YHcvj6GT2YYXdXww'; // River
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'; // half the credits of the premium model
const FORMAT = 'mp3_44100_64';
const force = process.env.FORCE === '1';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'signal-audio');
const manifestPath = join(outDir, 'manifest.json');
mkdirSync(outDir, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

// the briefing first: it is the shortest, so any problem shows up cheaply
const items = [
  { id: 'briefing', text: issueScript(DISPATCHES).join(' ') },
  ...DISPATCHES.map((d) => ({ id: d.id, text: dispatchScript(d).join(' ') })),
];

let spent = 0;
for (const { id, text } of items) {
  const hash = createHash('sha256').update(`${VOICE}|${MODEL}|${FORMAT}|${text}`).digest('hex').slice(0, 16);
  const file = join(outDir, `${id}.mp3`);
  if (!force && manifest[id]?.hash === hash && existsSync(file)) {
    console.log(`skip   ${id} (unchanged)`);
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) {
    console.error(`FAILED ${id}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  manifest[id] = { hash, chars: text.length, bytes: buf.length, voice: VOICE, model: MODEL, format: FORMAT };
  spent += text.length;
  console.log(`wrote  ${id}: ${text.length} chars, ${(buf.length / 1024).toFixed(0)} KB`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`done. characters sent this run: ${spent}`);
