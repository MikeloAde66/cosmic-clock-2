// Captions for a dispatch's visual: the spoken script cut into short lines,
// each with the scene it belongs to and roughly when it is spoken, as a share
// of the recording. Timing is by character count, which tracks natural pacing
// to within about a second; it needs no extra audio work.

import type { Dispatch } from './dispatches.ts';
import { chunk, scriptParts } from './speech.ts';

const MAX_LINE = 92;

// A clause with no comma can still be too long for a two-line caption: break it between words.
function wrapWords(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts = Math.ceil(text.length / max);
  const target = Math.ceil(text.length / parts);
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && cur.length + 1 + w.length > target + 12) {
      out.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export interface CaptionLine {
  text: string;
  /** index into the dispatch's visual scenes */
  scene: number;
  /** where this line starts, 0..1 of the recording */
  at: number;
}

export function captionTimeline(d: Dispatch): CaptionLine[] {
  const scenes = d.visual?.scenes ?? [];
  const parts = scriptParts(d);
  const lines: { text: string; scene: number }[] = [];
  let scene = 0;
  for (const part of parts) {
    const next = scenes.findIndex((s, i) => i > scene && s.from === part.key);
    if (next > -1) scene = next;
    for (const piece of chunk(part.text, MAX_LINE)) for (const text of wrapWords(piece, MAX_LINE)) lines.push({ text, scene });
  }
  const total = lines.reduce((n, l) => n + l.text.length + 1, 0);
  let seen = 0;
  return lines.map((l) => {
    const at = seen / total;
    seen += l.text.length + 1;
    return { ...l, at };
  });
}

/** The line being spoken at a given moment (fraction 0..1 of the recording). */
export function lineAt(lines: CaptionLine[], fraction: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid].at <= fraction) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
