// Pilot progress for the Flight Academy, kept in this browser's
// localStorage (same approach as Ground School). Every access is guarded so
// a private window or blocked storage just means "fresh pilot".

const STORAGE_KEY = 'ai-one-flight-academy-v1';

export interface LessonResult {
  stars: number;
  bestTime: number;
  /** Best 0-100 flight score (absent for results saved before scoring). */
  bestScore?: number;
  at: number;
}

export interface EvalProfile {
  hover: number;
  altitude: number;
  response: number;
  orientation: number;
  smoothness: number;
  overall: number;
}

export interface LogEntry {
  lessonId: string;
  title: string;
  stars: number;
  time: number;
  score?: number;
  at: number;
}

export interface PilotProgress {
  done: Record<string, LessonResult>;
  xp: number;
  flightSecs: number;
  evaluation: EvalProfile | null;
  log: LogEntry[];
}

export const EMPTY_PROGRESS: PilotProgress = { done: {}, xp: 0, flightSecs: 0, evaluation: null, log: [] };

export const RANKS = [
  { xp: 0, title: 'Cadet' },
  { xp: 100, title: 'Student Pilot' },
  { xp: 300, title: 'Pilot' },
  { xp: 600, title: 'Senior Pilot' },
  { xp: 1000, title: 'Mission Commander' },
];

export function rankFor(xp: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.xp) idx = i;
  });
  const next = RANKS[idx + 1] ?? null;
  const cur = RANKS[idx];
  const pct = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { title: cur.title, next, pct: Math.max(0, Math.min(1, pct)) };
}

export function loadProgress(): PilotProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_PROGRESS, ...parsed, done: parsed.done ?? {}, log: parsed.log ?? [] };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveProgress(p: PilotProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: progress lives for this tab only */
  }
}

export function xpFor(stars: number, checkride: boolean) {
  return stars * 30 + (checkride ? 50 : 0);
}

/** Record a finished lesson; XP is only awarded for improving on a previous best. */
export function recordResult(
  p: PilotProgress,
  lesson: { id: string; title: string; checkride?: boolean },
  stars: number,
  time: number,
  evaluation?: EvalProfile | null,
  score?: number,
): { next: PilotProgress; gained: number } {
  const prev = p.done[lesson.id];
  const prevXp = prev ? xpFor(prev.stars, !!lesson.checkride) : 0;
  const nowXp = xpFor(stars, !!lesson.checkride);
  const gained = Math.max(0, nowXp - prevXp);
  const result: LessonResult = {
    stars: Math.max(stars, prev?.stars ?? 0),
    bestTime: prev ? Math.min(prev.bestTime, time) : time,
    bestScore: Math.max(score ?? 0, prev?.bestScore ?? 0) || undefined,
    at: Date.now(),
  };
  const next: PilotProgress = {
    ...p,
    done: { ...p.done, [lesson.id]: result },
    xp: p.xp + gained,
    flightSecs: p.flightSecs + time,
    evaluation: evaluation ?? p.evaluation,
    log: [{ lessonId: lesson.id, title: lesson.title, stars, time, score, at: Date.now() }, ...p.log].slice(0, 30),
  };
  return { next, gained };
}

export function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
