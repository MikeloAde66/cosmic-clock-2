// The lines the hub's Signal ticker types out: the magazine's tagline, broken
// into short phrases that read like subtitles, then every dispatch's headline
// with its one-line summary. Everything comes from the real Signal content.

import { DISPATCHES } from './dispatches.ts';
import type { Dispatch } from './dispatches.ts';

export const TAGLINE = [
  'The numbers behind the news —',
  'where the money actually moves,',
  'who actually pays,',
  "and what's buried on page 47.",
];

export function tickerLines(list: Dispatch[] = DISPATCHES): string[] {
  return [...TAGLINE, ...list.map((d) => `${d.headline} — ${d.dek}`)];
}
