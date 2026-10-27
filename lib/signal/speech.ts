// Turns Signal dispatches into text that reads well aloud. Pure functions, so
// the script can be tested without a browser or a speech engine.

import type { Dispatch } from './dispatches.ts';

const MAX_CHUNK = 220;

/** Make written text easier on a speech engine. */
export function speakable(text: string): string {
  return text
    .replace(/\s+—\s+|—/g, ', ')
    .replace(/\bvs\.\s/g, 'versus ')
    .replace(/\s&\s/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split text into sentences, then pack them into pieces short enough that browsers do not cut them off. */
export function chunk(text: string, max = MAX_CHUNK): string[] {
  const sentences = speakable(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  const push = () => {
    if (cur) out.push(cur);
    cur = '';
  };
  for (const s of sentences) {
    if (s.length > max) {
      // a very long sentence: break at commas or semicolons, never mid-word
      push();
      let part = '';
      for (const piece of s.split(/(?<=[,;:])\s+/)) {
        if (part && (part + ' ' + piece).length > max) {
          out.push(part);
          part = piece;
        } else {
          part = part ? part + ' ' + piece : piece;
        }
      }
      if (part) out.push(part);
    } else if (cur && (cur + ' ' + s).length > max) {
      push();
      cur = s;
    } else {
      cur = cur ? cur + ' ' + s : s;
    }
  }
  push();
  return out;
}

const sentenceCase = (s: string) => {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export interface ScriptPart {
  /** where the text comes from: head, dek, kind, body:N, brief:N, ticker:N, callout */
  key: string;
  text: string;
}

/** The spoken script for one dispatch as labelled parts, so captions and scenes can follow along. */
export function scriptParts(d: Dispatch): ScriptPart[] {
  const parts: ScriptPart[] = [
    { key: 'head', text: d.headline + '.' },
    { key: 'dek', text: d.dek },
    {
      key: 'kind',
      text:
        d.kind === 'sample'
          ? 'This is a sample dispatch. The companies and figures are illustrative, not real reporting.'
          : 'This is an explainer: general background, not a news report.',
    },
  ];
  d.body.forEach((p, i) => parts.push({ key: `body:${i}`, text: p }));
  if (d.brief) {
    d.brief.forEach((b, i) => {
      const label = b.num.split('·')[1]?.trim() ?? '';
      parts.push({ key: `brief:${i}`, text: `Number ${i + 1}${label ? ', ' + sentenceCase(label) : ''}. ${b.h}. ${b.p}` });
    });
  }
  if (d.ticker) d.ticker.forEach((t, i) => parts.push({ key: `ticker:${i}`, text: `${t.h}: ${t.status}. ${t.p}` }));
  if (d.callout) parts.push({ key: 'callout', text: `${sentenceCase(d.callout.k)}. ${d.callout.text}` });
  return parts;
}

/** The spoken script for one dispatch, labelled honestly up front. */
export function dispatchScript(d: Dispatch): string[] {
  return scriptParts(d).flatMap((p) => chunk(p.text));
}

/** A short spoken briefing of the whole issue: each headline and its one-line summary. */
export function issueScript(list: Dispatch[]): string[] {
  const parts = [
    `Signal. A sample issue with ${list.length} dispatches. These are evergreen explainers and sample formats, not live news.`,
    ...list.map((d, i) => `${i + 1}. ${d.headline}. ${d.dek}`),
  ];
  return parts.flatMap((p) => chunk(p));
}

/** Rough listening time in whole minutes (at least 1), at a typical speaking pace. */
export function listenMinutes(chunks: string[]): number {
  const words = chunks.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 150));
}

export interface AudioManifestEntry {
  bytes: number;
  /** e.g. mp3_44100_64: the number at the end is the bitrate in kbps */
  format: string;
}

/** Where a pre-generated recording lives and how long it runs, worked out from its size and bitrate. */
export function audioFrom(manifest: Record<string, AudioManifestEntry>, id: string): { src: string; seconds: number } | undefined {
  const m = manifest[id];
  if (!m) return undefined;
  const kbps = Number(/_(\d+)$/.exec(m.format)?.[1] ?? 64);
  return { src: `/signal-audio/${id}.mp3`, seconds: Math.max(1, Math.round((m.bytes * 8) / (kbps * 1000))) };
}

export function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
