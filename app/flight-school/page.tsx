'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  Gamepad2,
  Lock,
  Play,
  Star,
  Brain,
  Plane,
  ClipboardCheck,
  GraduationCap,
  Award,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import {
  CORE_LESSONS,
  LESSONS,
  MODULES,
  isUnlocked,
  lessonsIn,
  nextLesson,
  type ModuleId,
} from '@/lib/flightAcademy/curriculum';
import { EMPTY_PROGRESS, formatTime, loadProgress, rankFor, type PilotProgress } from '@/lib/flightAcademy/progress';

// Flight Academy: the landing page for /flight-school. A progression path
// from a hands-on simulator evaluation through three training modules,
// every lesson flown inside the real Spectre-AI GCS (see
// components/flightAcademy/Trainer.tsx). Ground School stays at
// /ground-school as the reference handbook and quiz.

const STEPS = [
  {
    icon: Brain,
    title: 'Brief',
    kind: 'Mental',
    text: 'Why the drone behaves the way it does, what to watch on the HUD, and a chair-fly rehearsal before you touch the sticks.',
  },
  {
    icon: Plane,
    title: 'Fly',
    kind: 'Physical',
    text: 'Fly it in the real simulator. Objectives check themselves live, and the gauge that matters lights up as you move each stick.',
  },
  {
    icon: ClipboardCheck,
    title: 'Debrief',
    kind: 'Review',
    text: 'A score out of 100 from time, precision and smoothness. Three stars takes 85+. The instructor names the two things to fix first.',
  },
];

const MODULE_ACCENT: Record<ModuleId, string> = {
  eval: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  m1: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  m2: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  m3: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  adv: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
};

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}`} />
      ))}
    </span>
  );
}

export default function FlightSchoolPage() {
  const [progress, setProgress] = useState<PilotProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    // localStorage only exists after mount; reading it here avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadProgress());
  }, []);

  const done = progress.done;
  const rank = rankFor(progress.xp);
  const next = nextLesson(done);
  const doneCount = LESSONS.filter((l) => done[l.id]).length;
  const totalStars = LESSONS.reduce((a, l) => a + (done[l.id]?.stars ?? 0), 0);
  const wings = CORE_LESSONS.every((l) => done[l.id]);
  const advanced = lessonsIn('adv').every((l) => done[l.id]);
  const started = doneCount > 0;

  return (
    // body is overflow:hidden globally (the main dashboard owns its own
    // scroll containers), so this page scrolls inside its own fixed layer.
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-[#07090E] text-slate-100 font-mono">
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-[#07090E]/90 backdrop-blur">
        <div className="flex items-center justify-between max-w-5xl gap-4 px-4 py-3 mx-auto">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.3em] text-cyan-400 uppercase">Flight School</p>
            <p className="text-sm font-bold text-white">Ai One Flight Academy</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[11px] text-slate-300">
                {rank.title} · <span className="text-cyan-300 tabular-nums">{progress.xp} XP</span>
              </p>
              <div className="w-40 h-1 mt-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.round(rank.pct * 100)}%` }} />
              </div>
            </div>
            <Link
              href="/"
              aria-label="Home"
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl px-4 pb-10 mx-auto">
        {/* Hero */}
        <section className="pt-12 pb-10 text-center sm:pt-16">
          <p className="text-xs tracking-[0.3em] text-cyan-400 uppercase">Flight Academy</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl text-balance">Learn to fly, then prove it.</h1>
          <p className="max-w-xl mx-auto mt-3 text-sm leading-relaxed text-slate-400">
            Fly first, learn why it works, then fly real missions. Every lesson runs inside the Spectre-AI GCS
            simulator, and you pass it by flying it.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 mt-7 sm:flex-row">
            {next ? (
              <Link
                href={`/flight-school/train/${next.id}`}
                className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-wide uppercase rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Play className="w-4 h-4" />
                {started ? `Continue: ${next.code} ${next.title}` : 'Start your Flight Evaluation'}
              </Link>
            ) : (
              <Link
                href="/flight-school/train/evaluation"
                className="flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-wide uppercase rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <RotateCcw className="w-4 h-4" /> Re-fly your evaluation
              </Link>
            )}
            <Link
              href="/flight-school/simulator"
              className="flex items-center gap-2 px-5 py-3 text-xs tracking-wide uppercase border rounded-lg border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-white"
            >
              <Gamepad2 className="w-4 h-4" /> Free flight
            </Link>
          </div>
          {!started && (
            <p className="mt-3 text-[11px] text-slate-500">About 4 minutes. No reading required. Mouse, keyboard or gamepad.</p>
          )}
        </section>

        {/* Pilot status */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['Rank', rank.title],
              ['Lessons', `${doneCount} / ${LESSONS.length}`],
              ['Stars', `${totalStars} / ${LESSONS.length * 3}`],
              ['Sim time', formatTime(progress.flightSecs)],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="p-3 border rounded-xl border-slate-800 bg-slate-900/40">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p>
              <p className="mt-1 text-sm font-bold text-white tabular-nums">{v}</p>
            </div>
          ))}
        </section>

        {/* How every lesson works */}
        <section className="mt-12">
          <h2 className="text-xs tracking-[0.25em] uppercase text-slate-400">How every lesson works</h2>
          <ol className="grid gap-3 mt-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="p-4 border rounded-2xl border-slate-800 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <s.icon className="w-4 h-4 text-cyan-300" />
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{s.kind}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Flight path */}
        <section className="mt-12">
          <h2 className="text-xs tracking-[0.25em] uppercase text-slate-400">Your flight path</h2>
          <p className="mt-1 text-xs text-slate-500">
            Lessons unlock in order, so the basics are in place before you need them.
          </p>

          <ol className="relative mt-6 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
            {MODULES.map((mod) => {
              const lessons = lessonsIn(mod.id);
              const modDone = lessons.filter((l) => done[l.id]).length;
              const modOpen = lessons.some((l) => isUnlocked(l, done));
              const complete = modDone === lessons.length;
              return (
                <li key={mod.id} className="relative pl-12">
                  <span
                    className={`absolute left-0 top-1 flex items-center justify-center w-10 h-10 rounded-xl border text-[11px] font-bold ${
                      complete
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : modOpen
                          ? MODULE_ACCENT[mod.id]
                          : 'border-slate-800 bg-slate-900 text-slate-600'
                    }`}
                  >
                    {modOpen ? `${modDone}/${lessons.length}` : <Lock className="w-4 h-4" />}
                  </span>

                  <div
                    className={`p-5 border rounded-2xl ${
                      modOpen ? 'border-slate-800 bg-slate-900/40' : 'border-slate-800/60 bg-slate-900/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">{mod.label}</p>
                        <h3 className={`mt-0.5 text-base font-bold ${modOpen ? 'text-white' : 'text-slate-500'}`}>
                          {mod.title}
                        </h3>
                      </div>
                      {complete && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-300">Complete</span>
                      )}
                    </div>
                    <p className="max-w-2xl mt-2 text-xs leading-relaxed text-slate-400">{mod.summary}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[11px] text-slate-500">
                      <span>
                        <span className="text-slate-300">Mental:</span> {mod.mental}
                      </span>
                      <span>
                        <span className="text-slate-300">Physical:</span> {mod.physical}
                      </span>
                    </div>

                    <ul className="mt-4 divide-y divide-slate-800/80">
                      {lessons.map((l) => {
                        const res = done[l.id];
                        const open = isUnlocked(l, done);
                        const isNext = next?.id === l.id;
                        const row = (
                          <div className="flex items-center gap-3 py-2.5">
                            <span className="w-8 text-[11px] tabular-nums text-slate-500 shrink-0">{l.code}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${open ? 'text-slate-100' : 'text-slate-600'}`}>
                                {l.title}
                                {l.checkride && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-300">Checkride</span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {l.skill} · {l.minutes} min
                              </p>
                            </div>
                            {res ? (
                              <span className="flex items-center gap-2">
                                {res.bestScore != null && (
                                  <span className="text-[11px] tabular-nums text-slate-500">{res.bestScore}</span>
                                )}
                                <Stars n={res.stars} />
                              </span>
                            ) : open ? (
                              <span
                                className={`flex items-center gap-1 text-[11px] uppercase tracking-wide ${
                                  isNext ? 'text-cyan-300' : 'text-slate-400'
                                }`}
                              >
                                {isNext ? 'Up next' : 'Fly'} <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-700" />
                            )}
                          </div>
                        );
                        return (
                          <li key={l.id}>
                            {open ? (
                              <Link
                                href={`/flight-school/train/${l.id}`}
                                className={`block -mx-2 px-2 rounded-lg transition hover:bg-white/5 ${
                                  isNext ? 'bg-cyan-500/5' : ''
                                }`}
                              >
                                {row}
                              </Link>
                            ) : (
                              row
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}

            <li className="relative pl-12">
              <span
                className={`absolute left-0 top-1 flex items-center justify-center w-10 h-10 rounded-xl border ${
                  wings ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-600'
                }`}
              >
                <Award className="w-5 h-5" />
              </span>
              <div className="p-5 border rounded-2xl border-slate-800/60 bg-slate-900/20">
                <h3 className={`text-base font-bold ${wings ? 'text-amber-200' : 'text-slate-500'}`}>Ai One Wings</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {wings
                    ? 'Every core lesson and checkride flown. You earned your wings.'
                    : 'Finish Modules 1–3 and both checkrides to earn your wings.'}
                </p>
                <p className={`mt-1 text-xs ${advanced ? 'text-violet-300' : 'text-slate-500'}`}>
                  {advanced
                    ? 'Advanced Proficiency complete: nose-in, figure-8 and the nose-in box checkride.'
                    : 'Advanced Proficiency is optional, for pilots who want a ceiling to chase.'}
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Evaluation + logbook */}
        {(progress.evaluation || progress.log.length > 0) && (
          <section className="grid gap-3 mt-12 sm:grid-cols-2">
            {progress.evaluation && (
              <div className="p-4 border rounded-2xl border-slate-800 bg-slate-900/40">
                <h2 className="text-xs tracking-[0.2em] uppercase text-slate-400">Stick-feel profile</h2>
                <div className="mt-3 space-y-2">
                  {(
                    [
                      ['Hover precision', progress.evaluation.hover],
                      ['Altitude control', progress.evaluation.altitude],
                      ['Response', progress.evaluation.response],
                      ['Orientation', progress.evaluation.orientation],
                      ['Smoothness', progress.evaluation.smoothness],
                    ] as [string, number][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-32 text-[11px] text-slate-400 shrink-0">{k}</span>
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${v}%` }} />
                      </div>
                      <span className="w-7 text-right text-[11px] tabular-nums text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {progress.log.length > 0 && (
              <div className="p-4 border rounded-2xl border-slate-800 bg-slate-900/40">
                <h2 className="text-xs tracking-[0.2em] uppercase text-slate-400">Logbook</h2>
                <ul className="mt-3 space-y-2">
                  {progress.log.slice(0, 6).map((e) => (
                    <li key={e.at} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="truncate text-slate-300">{e.title}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        {e.score != null && <span className="tabular-nums text-slate-500">{e.score}</span>}
                        <Stars n={e.stars} />
                        <span className="w-10 text-right tabular-nums text-slate-500">{formatTime(e.time)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Ground School reference */}
        <section className="mt-12">
          <Link
            href="/ground-school"
            className="flex items-center gap-4 p-4 transition border rounded-2xl border-slate-800 bg-slate-900/40 hover:border-emerald-500/50"
          >
            <span className="flex items-center justify-center border rounded-xl w-11 h-11 shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <GraduationCap className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white">Ground School handbook</span>
              <span className="block mt-0.5 text-xs text-slate-400">
                Terminology, flight modes, FAA rules, a knowledge check and an AI instructor to ask questions.
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-800/80">
        <div className="max-w-5xl px-4 py-6 mx-auto text-[11px] leading-relaxed text-slate-500">
          <p>
            Flight Academy lessons, stars, ranks and wings are personal-accomplishment badges from Ai One. They are not
            an FAA credential, license, or legal authorization to fly. US recreational flyers must pass the FAA&apos;s
            free{' '}
            <a
              href="https://www.faasafety.gov/gslac/ALC/course_catalog.aspx"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-300"
            >
              TRUST exam
            </a>{' '}
            before flying at all; anyone flying for work or business needs a Part 107 Remote Pilot Certificate. Progress
            is saved in this browser only.
          </p>
        </div>
      </footer>
    </div>
  );
}
