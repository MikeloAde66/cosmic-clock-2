'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Circle,
  Hand,
  Play,
  RotateCcw,
  Star,
  Wind,
  Zap,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { GcsBridge, type HudKey, type StickInput } from '@/lib/flightAcademy/gcs';
import { LESSONS, MODULES, lessonById, type Lesson, type Mem } from '@/lib/flightAcademy/curriculum';
import {
  formatTime,
  loadProgress,
  recordResult,
  saveProgress,
  type EvalProfile,
} from '@/lib/flightAcademy/progress';

type Phase = 'loading' | 'brief' | 'flying' | 'debrief' | 'crashed';

interface Coach {
  key: string;
  title: string;
  body: string;
  mav: string;
  hud: HudKey[];
}

interface Debrief {
  stars: number;
  time: number;
  gained: number;
  objTimes: number[];
  smoothness: number;
  evaluation: EvalProfile | null;
}

const TICK = 0.1;

// "Aero Link": what the student's current stick input is physically doing
// to the propellers, and which HUD element shows it. Wording changes with
// mode because STABILIZE and POSHOLD interpret the right stick differently.
function coachFor(input: StickInput, mode: string): Coach | null {
  const axes: [keyof StickInput, number][] = [
    ['thr', input.thr],
    ['pitch', input.pitch],
    ['roll', input.roll],
    ['yaw', input.yaw],
  ];
  axes.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [axis, v] = axes[0];
  if (Math.abs(v) < 0.2) return null;
  const manual = mode === 'STABILIZE';
  const modeLine = manual
    ? ' In STABILIZE the stick sets the tilt directly. Let go and the drone keeps drifting.'
    : mode === 'POSHOLD'
      ? ' In POSHOLD your stick becomes a target speed, and the autopilot brakes when you let go.'
      : '';
  switch (axis) {
    case 'thr':
      return v > 0
        ? {
            key: 'thr+',
            title: 'Throttle up: more total thrust',
            body: 'All four motors speed up together. Thrust now exceeds weight, so the drone climbs. Centre the stick and it holds this altitude.',
            mav: 'VFR_HUD.climb > 0 · VFR_HUD.alt rising',
            hud: ['altTape', 'vsi', 'mavlink'],
          }
        : {
            key: 'thr-',
            title: 'Throttle down: thrust below weight',
            body: 'All four motors slow together. Thrust drops below weight and the drone sinks. Ease off before your target altitude; vertical momentum carries you past it.',
            mav: 'VFR_HUD.climb < 0',
            hud: ['altTape', 'vsi', 'mavlink'],
          };
    case 'pitch':
      return v > 0
        ? {
            key: 'pitch+',
            title: 'Pitch forward: thrust vector tilts ahead',
            body: `The rear motors spin faster than the front ones, so the nose dips. Part of the thrust now pushes you forward, and the SPD tape climbs. On the horizon, more brown (ground) shows as the nose drops.${modeLine}`,
            mav: 'ATTITUDE.pitch < 0 · VFR_HUD.groundspeed rising',
            hud: ['horizon', 'spdTape', 'mavlink'],
          }
        : {
            key: 'pitch-',
            title: 'Pitch back: thrust vector tilts behind',
            body: `The front motors speed up and the nose rises. Thrust leans backward: first you brake, then you fly backwards.${modeLine}`,
            mav: 'ATTITUDE.pitch > 0',
            hud: ['horizon', 'spdTape', 'mavlink'],
          };
    case 'roll':
      return {
        key: v > 0 ? 'roll+' : 'roll-',
        title: v > 0 ? 'Roll right: bank and slide right' : 'Roll left: bank and slide left',
        body: `The ${v > 0 ? 'left' : 'right'} motors spin faster than the ${v > 0 ? 'right' : 'left'} ones, so the drone banks ${v > 0 ? 'right' : 'left'} and its thrust pushes it sideways. The horizon line tilts the opposite way to your bank.${modeLine}`,
        mav: 'ATTITUDE.roll',
        hud: ['horizon', 'map', 'mavlink'],
      };
    case 'yaw':
      return {
        key: v > 0 ? 'yaw+' : 'yaw-',
        title: v > 0 ? 'Yaw right: torque turns the nose' : 'Yaw left: torque turns the nose',
        body: 'The clockwise pair and the counter-clockwise pair change speed against each other. The torque imbalance spins the airframe. There is no tilt, so the drone doesn\'t move sideways; only the nose turns.',
        mav: 'ATTITUDE.yaw · VFR_HUD.heading',
        hud: ['heading', 'cam', 'mavlink'],
      };
  }
  return null;
}

const clamp100 = (v: number) => Math.round(Math.max(0, Math.min(100, v)));

function evalProfile(mem: Mem, objTimes: number[], jerkRate: number): EvalProfile {
  const n = Math.max(1, mem.hoverN ?? 1);
  const dev = (mem.hoverDevSum ?? 0) / n;
  const altDev = (mem.hoverAltSum ?? 0) / n;
  const hover = clamp100(100 - dev * 14 - Math.max(0, (objTimes[2] ?? 10) - 10) * 2);
  const altitude = clamp100(100 - altDev * 30);
  const response = clamp100(100 - Math.max(0, (objTimes[3] ?? 0) + (objTimes[4] ?? 0) - 4) * 5);
  const orientation = clamp100(100 - Math.max(0, (objTimes[5] ?? 0) - 2) * 8);
  const smoothness = clamp100(100 - jerkRate * 40);
  const overall = Math.round((hover + altitude + response + orientation + smoothness) / 5);
  return { hover, altitude, response, orientation, smoothness, overall };
}

function evalVerdict(p: EvalProfile) {
  if (p.overall >= 75)
    return 'Strong natural stick feel. Module 1 will still matter: it explains why your hands already know what to do, and that knowledge is what saves you when automation fails.';
  if (p.overall >= 45)
    return 'Your feel is developing. You can fly, but the corrections are late or large. Module 1 builds the anticipation that turns that into smooth control.';
  return 'Fresh hands, and no bad habits to unlearn. Take Module 1 slowly and chair-fly every brief. Most pilots double this score after the first module.';
}

export default function Trainer({ lessonId }: { lessonId: string }) {
  const lesson = lessonById(lessonId);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<GcsBridge | null>(null);
  const runRef = useRef({
    objIdx: 0,
    started: false,
    acc: 0,
    t: 0,
    objStart: 0,
    objTimes: [] as number[],
    mem: {} as Mem,
    jerk: 0,
    lastInput: { pitch: 0, roll: 0, yaw: 0, thr: 0 } as StickInput,
  });
  const coachRef = useRef<{ coach: Coach | null; at: number }>({ coach: null, at: 0 });
  const hlKeyRef = useRef('');
  const setupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [objIdx, setObjIdx] = useState(0);
  const [prog, setProg] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [crashReason, setCrashReason] = useState('');
  const [telemetry, setTelemetry] = useState({ mode: '—', wind: 0 });

  const phaseRef = useRef<Phase>('loading');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const modInfo = lesson ? MODULES.find((m) => m.id === lesson.module) : null;
  const nextL = lesson ? LESSONS[LESSONS.indexOf(lesson) + 1] ?? null : null;

  // Wait for the embedded simulator to boot and expose its store. Polled
  // from mount rather than the iframe's onLoad: a cached simulator can
  // finish loading before React hydrates and attaches that handler.
  useEffect(() => {
    if (!frameRef.current) return;
    const b = new GcsBridge(frameRef.current);
    bridgeRef.current = b;
    const poll = setInterval(() => {
      if (b.ready()) {
        clearInterval(poll);
        setPhase((p) => (p === 'loading' ? 'brief' : p));
      }
    }, 150);
    return () => clearInterval(poll);
  }, []);

  const startFlight = () => {
    const b = bridgeRef.current;
    if (!b || !lesson) return;
    if (setupTimer.current) clearTimeout(setupTimer.current);
    b.clearAll();
    b.normalSpeed();
    if (lesson.start === 'pad') b.resetOnPad();
    else b.resetAirborne();
    runRef.current = {
      objIdx: 0,
      started: false,
      acc: 0,
      t: 0,
      objStart: 0,
      objTimes: [],
      mem: {},
      jerk: 0,
      lastInput: { pitch: 0, roll: 0, yaw: 0, thr: 0 },
    };
    setObjIdx(0);
    setProg(0);
    setElapsed(0);
    setNote(null);
    setDebrief(null);
    // Reset clears faults, so apply this lesson's weather just after it.
    setupTimer.current = setTimeout(() => {
      b.setWind(lesson.wind ?? 0, lesson.windFrom ?? 270);
      b.setFault('gpsLoss', false);
      b.setFault('linkLoss', false);
      b.setFault('gusts', !!lesson.gusts);
      setPhase('flying');
      b.focusSim();
    }, 300);
  };

  // Main loop: coach + objectives, 10 Hz.
  useEffect(() => {
    if (!lesson) return;
    const finish = (l: Lesson) => {
      const run = runRef.current;
      const time = run.t;
      const jerkRate = run.jerk / Math.max(1, time);
      const smoothness = clamp100(100 - jerkRate * 40);
      let stars = time <= l.par ? 3 : time <= l.par * 1.6 ? 2 : 1;
      // Camera work is judged on smoothness as much as speed.
      if (l.module === 'm3' && l.id === 'aerial-photo' && smoothness < 60) stars = Math.max(1, stars - 1);
      const evaluation = l.id === 'evaluation' ? evalProfile(run.mem, run.objTimes, jerkRate) : null;
      const { next, gained } = recordResult(loadProgress(), l, stars, time, evaluation);
      saveProgress(next);
      setDebrief({ stars, time, gained, objTimes: [...run.objTimes], smoothness, evaluation });
      setPhase('debrief');
      bridgeRef.current?.clearAll();
    };

    const id = setInterval(() => {
      const b = bridgeRef.current;
      if (!b) return;
      const s = b.snapshot();
      if (!s) return;
      setTelemetry({ mode: s.mode, wind: s.windSpd });

      const now = performance.now();
      const c = coachFor(s.input, s.mode);
      if (c) {
        if (c.key !== coachRef.current.coach?.key) setCoach(c);
        coachRef.current = { coach: c, at: now };
      }
      const coachActive = coachRef.current.coach && now - coachRef.current.at < 2500;

      const run = runRef.current;
      const ph = phaseRef.current;
      let objectiveHud: HudKey[] = [];

      if (ph === 'flying') {
        run.t += TICK;
        const d =
          Math.abs(s.input.pitch - run.lastInput.pitch) +
          Math.abs(s.input.roll - run.lastInput.roll) +
          Math.abs(s.input.yaw - run.lastInput.yaw) +
          Math.abs(s.input.thr - run.lastInput.thr);
        run.jerk += d;
        run.lastInput = { ...s.input };

        if (s.crashed) {
          const fs = [...s.logs].reverse().find((l) => l.type === 'FS');
          setCrashReason(fs?.text ?? 'The aircraft hit the ground too hard.');
          setPhase('crashed');
          b.clearAll();
          return;
        }

        const o = lesson.objectives[run.objIdx];
        if (o) {
          if (!run.started) {
            run.started = true;
            run.acc = 0;
            run.objStart = run.t;
            run.mem.note = undefined;
            o.onStart?.(s, run.mem, b);
            b.point(o.point ?? null);
          }
          o.onTick?.(s, run.mem, TICK);
          const ok = o.check(s, run.mem);
          let done = false;
          let p = 0;
          if (o.hold) {
            if (ok) run.acc += TICK;
            else if (!o.cumulative) run.acc = 0;
            p = run.acc / o.hold;
            done = run.acc >= o.hold;
          } else {
            p = o.progress ? o.progress(s, run.mem) : 0;
            done = ok;
          }
          objectiveHud = o.watch ?? [];
          setProg(Math.min(1, p));
          setNote(run.mem.note ?? null);
          setElapsed(run.t);
          if (done) {
            o.onDone?.(s, run.mem, b);
            run.objTimes.push(run.t - run.objStart);
            run.objIdx += 1;
            run.started = false;
            setObjIdx(run.objIdx);
            setProg(0);
            if (run.objIdx >= lesson.objectives.length) {
              finish(lesson);
              return;
            }
          }
        }
      }

      const hud = new Set<HudKey>(objectiveHud);
      if (coachActive) coachRef.current.coach!.hud.forEach((k) => hud.add(k));
      const key = [...hud].sort().join(',');
      if (key !== hlKeyRef.current) {
        hlKeyRef.current = key;
        b.highlight([...hud]);
      }
    }, TICK * 1000);
    return () => clearInterval(id);
  }, [lesson]);

  useEffect(
    () => () => {
      if (setupTimer.current) clearTimeout(setupTimer.current);
    },
    [],
  );

  if (!lesson) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#07090E] text-slate-200 font-mono">
        <p>That lesson doesn&apos;t exist.</p>
        <Link href="/flight-school" className="text-cyan-300 underline">
          Back to Flight Academy
        </Link>
      </div>
    );
  }

  const obj = lesson.objectives[objIdx];

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row bg-[#07090E] text-slate-100">
      <div className="relative flex-1 min-h-0 min-w-0">
        <iframe
          ref={frameRef}
          src="/spectre-gcs.html"
          title="Spectre-AI GCS flight simulator"
          className="w-full h-full border-0"
        />
        {phase === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07090E]/80 font-mono text-xs text-cyan-300 tracking-widest">
            STARTING SIMULATOR…
          </div>
        )}
      </div>

      <aside className="flex flex-col w-full lg:w-[380px] shrink-0 max-h-[46vh] lg:max-h-none border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0A0E15] font-mono">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
          <Link
            href="/flight-school"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Academy
          </Link>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-slate-500">
            <span>
              Mode <span className="text-amber-300">{telemetry.mode}</span>
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3" />
              {telemetry.wind.toFixed(0)} m/s
            </span>
          </div>
        </div>

        <div className="px-4 pt-4 pb-3 border-b border-slate-800">
          <p className="text-[10px] tracking-[0.25em] uppercase text-cyan-400">
            {modInfo?.label} · Lesson {lesson.code}
            {lesson.checkride && <span className="ml-2 text-amber-300">Checkride</span>}
          </p>
          <h1 className="mt-1 text-lg font-bold leading-tight text-white">{lesson.title}</h1>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {lesson.skill} · about {lesson.minutes} min · par {formatTime(lesson.par)}
          </p>
        </div>

        <div className="flex-1 min-h-0 px-4 py-4 space-y-4 overflow-y-auto">
          {phase === 'loading' && <p className="text-xs text-slate-400">Loading the Spectre-AI GCS…</p>}

          {phase === 'brief' && (
            <>
              <section>
                <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-300">
                  <BookOpen className="w-3.5 h-3.5" /> Why it works
                </h2>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300">
                  {lesson.brief.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">Watch on the HUD</h2>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-300 list-disc pl-4 marker:text-cyan-500">
                  {lesson.brief.watch.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
              <section className="p-3 border rounded-xl border-amber-500/30 bg-amber-500/5">
                <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                  <Brain className="w-3.5 h-3.5" /> Chair-fly it first
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{lesson.brief.chairFly}</p>
              </section>
              <section className="p-3 border rounded-xl border-emerald-500/30 bg-emerald-500/5">
                <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                  <Hand className="w-3.5 h-3.5" /> Real-world rep
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{lesson.brief.realWorld}</p>
              </section>
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Your objectives</h2>
                <ol className="mt-2 space-y-1.5 text-xs text-slate-400">
                  {lesson.objectives.map((o, i) => (
                    <li key={o.text} className="flex gap-2">
                      <span className="text-slate-600 tabular-nums">{i + 1}.</span>
                      {o.text}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {phase === 'flying' && (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Step {Math.min(objIdx + 1, lesson.objectives.length)} of {lesson.objectives.length}
                </span>
                <span className="tabular-nums text-slate-200">{formatTime(elapsed)}</span>
              </div>
              <ol className="space-y-2">
                {lesson.objectives.map((o, i) => {
                  const state = i < objIdx ? 'done' : i === objIdx ? 'active' : 'todo';
                  return (
                    <li
                      key={o.text}
                      className={`rounded-xl border p-3 text-xs transition ${
                        state === 'active'
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-white'
                          : state === 'done'
                            ? 'border-slate-800 bg-slate-900/40 text-slate-500'
                            : 'border-slate-800/60 text-slate-500'
                      }`}
                    >
                      <div className="flex gap-2">
                        {state === 'done' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        ) : (
                          <Circle className={`w-4 h-4 shrink-0 ${state === 'active' ? 'text-cyan-300' : 'text-slate-700'}`} />
                        )}
                        <span className={state === 'active' ? 'font-bold' : ''}>{o.text}</span>
                      </div>
                      {state === 'active' && (
                        <>
                          {(o.hold || o.progress) && (
                            <div className="h-1.5 mt-2.5 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full transition-[width] duration-100 rounded-full bg-cyan-400"
                                style={{ width: `${Math.round(prog * 100)}%` }}
                              />
                            </div>
                          )}
                          {o.tip && <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{o.tip}</p>}
                          {note && <p className="mt-2 text-[11px] text-amber-300">{note}</p>}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {obj?.watch && obj.watch.length > 0 && (
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Highlighted in the cockpit: <span className="text-cyan-300">{obj.watch.join(' · ')}</span>
                </p>
              )}
            </>
          )}

          {(phase === 'brief' || phase === 'flying') && (
            <section className="p-3 border rounded-xl border-slate-800 bg-slate-900/60">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-300">
                <Zap className="w-3.5 h-3.5" /> Aero link
              </h2>
              {coach ? (
                <>
                  <p className="mt-1.5 text-xs font-bold text-white">{coach.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{coach.body}</p>
                  <p className="mt-2 text-[10px] text-slate-500">MAVLink: {coach.mav}</p>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Move a stick and this card explains what the propellers are doing. The matching gauge lights up in
                  the cockpit. Click inside the simulator to fly with W/S/A/D and the arrow keys, or use the on-screen
                  sticks or a gamepad.
                </p>
              )}
            </section>
          )}

          {phase === 'debrief' && debrief && (
            <>
              <section className="text-center">
                <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-400">
                  {lesson.checkride ? 'Checkride passed' : 'Lesson complete'}
                </p>
                <div className="flex justify-center gap-1 mt-2" aria-label={`${debrief.stars} of 3 stars`}>
                  {[1, 2, 3].map((i) => (
                    <Star
                      key={i}
                      className={`w-7 h-7 ${i <= debrief.stars ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {formatTime(debrief.time)} flown · par {formatTime(lesson.par)} ·{' '}
                  <span className="text-cyan-300">+{debrief.gained} XP</span>
                </p>
              </section>

              {debrief.evaluation && (
                <section className="p-3 border rounded-xl border-slate-800 bg-slate-900/60">
                  <h2 className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">Your stick-feel profile</h2>
                  <div className="mt-3 space-y-2">
                    {(
                      [
                        ['Hover precision', debrief.evaluation.hover],
                        ['Altitude control', debrief.evaluation.altitude],
                        ['Response', debrief.evaluation.response],
                        ['Orientation', debrief.evaluation.orientation],
                        ['Smoothness', debrief.evaluation.smoothness],
                      ] as [string, number][]
                    ).map(([label, v]) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>{label}</span>
                          <span className="tabular-nums text-slate-200">{v}</span>
                        </div>
                        <div className="h-1.5 mt-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300">{evalVerdict(debrief.evaluation)}</p>
                </section>
              )}

              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Step times</h2>
                <ol className="mt-2 space-y-1 text-[11px] text-slate-400">
                  {lesson.objectives.map((o, i) => (
                    <li key={o.text} className="flex justify-between gap-3">
                      <span className="truncate">{o.text}</span>
                      <span className="tabular-nums text-slate-200">{(debrief.objTimes[i] ?? 0).toFixed(1)}s</span>
                    </li>
                  ))}
                </ol>
                {lesson.id === 'aerial-photo' && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Smoothness <span className="text-slate-200">{debrief.smoothness}</span>/100
                    {debrief.smoothness < 60 && ' (cost a star; hold steadier inputs)'}
                  </p>
                )}
              </section>

              <section className="p-3 border rounded-xl border-cyan-500/30 bg-cyan-500/5">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">Takeaway</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{lesson.takeaway}</p>
              </section>
            </>
          )}

          {phase === 'crashed' && (
            <section className="p-3 border rounded-xl border-rose-500/40 bg-rose-500/10">
              <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" /> Aircraft lost
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{crashReason}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Every pilot crashes in the sim; that&apos;s what it&apos;s for. Re-read the brief, chair-fly the step
                that went wrong, then fly it again. Slow down earlier than feels necessary.
              </p>
            </section>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-800">
          {phase === 'brief' && (
            <button
              onClick={startFlight}
              className="flex items-center justify-center flex-1 gap-2 py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              <Play className="w-4 h-4" /> Start flight
            </button>
          )}
          {phase === 'flying' && (
            <>
              <button
                onClick={startFlight}
                className="flex items-center justify-center flex-1 gap-1.5 py-2 text-[11px] uppercase tracking-wide border rounded-lg border-slate-700 text-slate-300 hover:border-slate-500"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart
              </button>
              <button
                onClick={() => {
                  bridgeRef.current?.clearAll();
                  setPhase('brief');
                }}
                className="flex items-center justify-center flex-1 gap-1.5 py-2 text-[11px] uppercase tracking-wide border rounded-lg border-slate-700 text-slate-300 hover:border-slate-500"
              >
                <BookOpen className="w-3.5 h-3.5" /> Brief
              </button>
            </>
          )}
          {(phase === 'debrief' || phase === 'crashed') && (
            <>
              <button
                onClick={startFlight}
                className="flex items-center justify-center flex-1 gap-1.5 py-2.5 text-[11px] uppercase tracking-wide border rounded-lg border-slate-700 text-slate-300 hover:border-slate-500"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Fly again
              </button>
              {phase === 'debrief' && nextL ? (
                <Link
                  href={`/flight-school/train/${nextL.id}`}
                  className="flex items-center justify-center flex-1 gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wide rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  Next: {nextL.title}
                </Link>
              ) : (
                <Link
                  href="/flight-school"
                  className="flex items-center justify-center flex-1 gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wide rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  Academy
                </Link>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
