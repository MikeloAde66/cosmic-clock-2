import type { Grade } from './curriculum';

// Flight score, 0-100. Passing a lesson is pass/fail on its objectives; the
// score is how well it was flown, and it sets the stars:
//   time       — 100 at or under par, 0 at twice par
//   precision  — the lesson's grades (lib/flightAcademy/curriculum.ts),
//                each mean error mapped between its `good` and `bad`,
//                weighted toward the weakest one
//   smoothness — how much the sticks were jerked around per second
// Lessons with no precision grades (autopilot missions, failsafe drills)
// are scored on time and smoothness alone.

export const THREE_STAR = 85;
export const TWO_STAR = 60;

export interface GradeTally {
  grade: Grade;
  sum: number;
  n: number;
}

export interface GradeResult {
  label: string;
  unit: Grade['unit'];
  mean: number;
  score: number;
  advice: string;
}

export interface FlightScore {
  total: number;
  time: number;
  precision: number | null;
  smoothness: number;
  stars: number;
  grades: GradeResult[];
}

const clamp100 = (v: number) => Math.round(Math.max(0, Math.min(100, v)));

/** Stick changes per second → 0-100. Gentle enough that keyboard (on/off) pilots aren't zeroed. */
export function smoothnessScore(jerkPerSec: number) {
  return clamp100(100 * Math.exp(-jerkPerSec / 2.5));
}

export function gradeScore(g: Grade, mean: number) {
  return clamp100(((g.bad - mean) / (g.bad - g.good)) * 100);
}

/** Merge tallies that measure the same thing across objectives (e.g. altitude on every box leg). */
export function mergeTallies(tallies: GradeTally[]): GradeResult[] {
  const byLabel = new Map<string, GradeTally>();
  for (const t of tallies) {
    if (!t.n) continue;
    const prev = byLabel.get(t.grade.label);
    if (prev) byLabel.set(t.grade.label, { grade: prev.grade, sum: prev.sum + t.sum, n: prev.n + t.n });
    else byLabel.set(t.grade.label, { ...t });
  }
  return [...byLabel.values()].map(({ grade, sum, n }) => {
    const mean = sum / n;
    return { label: grade.label, unit: grade.unit, mean, score: gradeScore(grade, mean), advice: grade.advice };
  });
}

export function scoreFlight(time: number, par: number, jerkPerSec: number, tallies: GradeTally[]): FlightScore {
  const timeScore = clamp100(100 - Math.max(0, time / par - 1) * 100);
  const smoothness = smoothnessScore(jerkPerSec);
  const grades = mergeTallies(tallies);
  // Precision leans on the weakest skill: a perfect altitude can't average
  // away a sloppy hover, which is what keeps three stars meaningful.
  const precision = grades.length
    ? clamp100(
        0.6 * Math.min(...grades.map((g) => g.score)) + (0.4 * grades.reduce((a, g) => a + g.score, 0)) / grades.length,
      )
    : null;
  const total =
    precision == null
      ? clamp100(timeScore * 0.75 + smoothness * 0.25)
      : clamp100(timeScore * 0.3 + precision * 0.55 + smoothness * 0.15);
  const stars = total >= THREE_STAR ? 3 : total >= TWO_STAR ? 2 : 1;
  return { total, time: timeScore, precision, smoothness, stars, grades };
}

export function formatErr(mean: number, unit: Grade['unit']) {
  return unit === '°' ? `${mean.toFixed(1)}°` : `${mean.toFixed(1)} ${unit}`;
}
