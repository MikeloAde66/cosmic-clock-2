// Which Space Drone missions have been completed, kept in this browser only.
// Every storage access is guarded: private windows and blocked storage must not
// break the game, they just forget.

import type { MissionId } from './missions.ts';

const KEY = 'astrosim.missions.v1';
const EVENT = 'astrosim-progress';

export function readProgressRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function parseProgress(raw: string): MissionId[] {
  try {
    const v: unknown = JSON.parse(raw || '[]');
    return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as MissionId[]) : [];
  } catch {
    return [];
  }
}

export function markComplete(id: MissionId): void {
  try {
    const done = new Set(parseProgress(readProgressRaw()));
    if (done.has(id)) return;
    done.add(id);
    window.localStorage.setItem(KEY, JSON.stringify([...done]));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable: the completion simply is not remembered
  }
}

export function subscribeProgress(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
