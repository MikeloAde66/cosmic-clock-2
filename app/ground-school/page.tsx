'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, CheckCircle2, Circle, ExternalLink, Award, AlertTriangle } from 'lucide-react';
import GroundSchoolInstructorChat from '@/components/groundSchool/GroundSchoolInstructorChat';

const STORAGE_KEY = 'ai-one-ground-school-progress-v1';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

// Mixes real multirotor terminology with real FAA facts — #9 doubles as
// the disclaimer showing up inside the quiz itself, not just in prose
// around it. QUIZ_PASS_COUNT is out of QUIZ_QUESTIONS.length.
const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: 'To "arm" a drone means to:',
    options: ['Attach the propellers', 'Enable the motors so they can spin', 'Turn on the camera', 'Calibrate the compass'],
    correctIndex: 1,
  },
  {
    question: "Which flight mode holds the drone's GPS position automatically?",
    options: ['Manual/Stabilize', 'Altitude-Hold', 'GPS/Loiter', 'RTL'],
    correctIndex: 2,
  },
  {
    question: 'RTL stands for:',
    options: ['Real-Time Logging', 'Return-To-Launch', 'Rotor Torque Limit', 'Remote Telemetry Link'],
    correctIndex: 1,
  },
  {
    question: '"Yaw" is rotation around which axis?',
    options: ['Vertical — nose turns left/right', 'Side-to-side tilt', 'Forward/backward tilt', 'Altitude change'],
    correctIndex: 0,
  },
  {
    question: 'Which of these is a real pre-flight check?',
    options: [
      'Skip the battery check if it was charged yesterday',
      'Confirm a GPS 3D fix with an adequate satellite count',
      'Fly immediately after powering on',
      'Ignore the geofence settings',
    ],
    correctIndex: 1,
  },
  {
    question: 'A well-configured failsafe for a GPS signal loss should:',
    options: [
      'Immediately cut all motors',
      'Fall back to a safe behavior instead of relying on GPS-dependent modes',
      'Increase speed to search for a signal',
      'Do nothing — GPS loss doesn\'t matter',
    ],
    correctIndex: 1,
  },
  {
    question: 'In the US, recreational drone flyers must, by law, first:',
    options: ['Buy drone insurance', "Pass the FAA's free TRUST exam", 'Register with an airline', 'Nothing is required'],
    correctIndex: 1,
  },
  {
    question: 'A Part 107 Remote Pilot Certificate is required for:',
    options: ['Flying indoors', 'Flying for recreation only', 'Flying for any commercial/work purpose', 'Flying toys only'],
    correctIndex: 2,
  },
  {
    question: "Completing this app's Ground School course and simulator checkride:",
    options: [
      'Issues you a real FAA Remote Pilot Certificate',
      'Automatically registers your drone with the FAA',
      'Gives you a completion badge for personal accomplishment — not a real FAA credential',
      'Replaces the TRUST test requirement',
    ],
    correctIndex: 2,
  },
  {
    question: '"Bank" in flight terms means:',
    options: ['Store flight logs', 'Tilt the aircraft to turn, usually by rolling', 'Land softly', 'Switch batteries mid-flight'],
    correctIndex: 1,
  },
];
const QUIZ_PASS_COUNT = 8;

const CHECKRIDE_TASKS = [
  'Arm the aircraft and complete pre-arm checks',
  'Take off and hold a stable hover for 10 seconds',
  'Climb to 30m and yaw a full 360°',
  'Bank left and right (roll) to change heading',
  'Fly to at least 2 waypoints using the Mission Map',
  'Trigger one failsafe test (GPS Loss or Link Loss) and watch the response',
  'Return-to-Launch and land safely',
];

interface Progress {
  quizAnswers: (number | null)[];
  quizSubmitted: boolean;
  checklist: boolean[];
  pilotName: string;
}

function loadProgress(): Progress {
  const fallback: Progress = {
    quizAnswers: QUIZ_QUESTIONS.map(() => null),
    quizSubmitted: false,
    checklist: CHECKRIDE_TASKS.map(() => false),
    pilotName: '',
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      quizAnswers: Array.isArray(parsed.quizAnswers) && parsed.quizAnswers.length === QUIZ_QUESTIONS.length ? parsed.quizAnswers : fallback.quizAnswers,
      quizSubmitted: Boolean(parsed.quizSubmitted),
      checklist: Array.isArray(parsed.checklist) && parsed.checklist.length === CHECKRIDE_TASKS.length ? parsed.checklist : fallback.checklist,
      pilotName: typeof parsed.pilotName === 'string' ? parsed.pilotName : '',
    };
  } catch {
    return fallback;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-5 border rounded-xl border-slate-800 bg-slate-900/30">
      <h2 className="text-sm font-bold tracking-wide text-cyan-400 uppercase">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function GroundSchoolPage() {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  useEffect(() => {
    if (!progress) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Private browsing / storage disabled — progress just won't persist
      // across reloads; the page still works fine within this session.
    }
  }, [progress]);

  if (!progress) {
    return <div className="w-full min-h-screen bg-[#07090E]" />;
  }

  const score = progress.quizAnswers.reduce<number>(
    (acc, answer, i) => acc + (answer === QUIZ_QUESTIONS[i].correctIndex ? 1 : 0),
    0
  );
  const quizPassed = progress.quizSubmitted && score >= QUIZ_PASS_COUNT;
  const checklistComplete = progress.checklist.every(Boolean);
  const certificateUnlocked = quizPassed && checklistComplete;

  const setAnswer = (qIndex: number, optionIndex: number) => {
    if (progress.quizSubmitted) return;
    const next = [...progress.quizAnswers];
    next[qIndex] = optionIndex;
    setProgress({ ...progress, quizAnswers: next });
  };

  const submitQuiz = () => {
    if (progress.quizAnswers.some((a) => a === null)) return;
    setProgress({ ...progress, quizSubmitted: true });
  };

  const retakeQuiz = () => {
    setProgress({ ...progress, quizAnswers: QUIZ_QUESTIONS.map(() => null), quizSubmitted: false });
  };

  const toggleTask = (i: number) => {
    const next = [...progress.checklist];
    next[i] = !next[i];
    setProgress({ ...progress, checklist: next });
  };

  return (
    <div className="w-full min-h-screen bg-[#07090E] text-slate-100">
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#07090E]/90 backdrop-blur">
        <div>
          <p className="text-xs font-mono tracking-[0.3em] text-cyan-400 uppercase">Flight School</p>
          <h1 className="text-lg font-bold">Ground School</h1>
        </div>
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
      </div>

      <div className="max-w-3xl px-4 py-8 mx-auto space-y-6">
        {/* Disclaimer banner — up top, not buried, per the real FAA framing
            we agreed on: this course is a practice tool and a personal
            accomplishment badge, never a real FAA credential. */}
        <div className="flex gap-3 p-4 text-sm border rounded-xl border-amber-500/30 bg-amber-500/5 text-amber-200">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p>
            This course and its completion certificate are a personal-accomplishment badge from Ai One — they are{' '}
            <strong>not a real FAA credential, license, or legal authorization to fly</strong>. US recreational
            flyers must pass the FAA&apos;s free{' '}
            <a
              href="https://www.faasafety.gov/gslac/ALC/course_catalog.aspx"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-amber-100"
            >
              TRUST exam
            </a>{' '}
            before flying at all; anyone flying for work or business needs a real Part 107 Remote Pilot Certificate.
          </p>
        </div>

        <Section title="1 · Core Controls & Terminology">
          <p><strong className="text-slate-100">Throttle</strong> — climbs or descends the aircraft (altitude).</p>
          <p><strong className="text-slate-100">Yaw</strong> — rotates the nose left or right around the vertical axis.</p>
          <p><strong className="text-slate-100">Pitch</strong> — tilts the nose forward/back, moving the aircraft forward or backward.</p>
          <p><strong className="text-slate-100">Roll / Bank</strong> — tilts side to side, turning the aircraft (pilots usually just say &quot;bank&quot;).</p>
          <p><strong className="text-slate-100">Arm / Disarm</strong> — enables or disables motor output; always confirm pre-arm checks pass first.</p>
          <p><strong className="text-slate-100">Hover</strong> — holding a stationary position in the air.</p>
        </Section>

        <Section title="2 · Flight Modes">
          <p><strong className="text-slate-100">Manual / Stabilize</strong> — full pilot control, auto-levels when sticks are centered.</p>
          <p><strong className="text-slate-100">Altitude-Hold</strong> — holds altitude automatically; you control horizontal movement.</p>
          <p><strong className="text-slate-100">GPS / Loiter</strong> — holds both position and altitude automatically.</p>
          <p><strong className="text-slate-100">RTL (Return-To-Launch)</strong> — autonomously flies back to the takeoff point and lands.</p>
          <p><strong className="text-slate-100">Auto / Mission</strong> — flies a pre-programmed waypoint mission, like the Mission Map in the simulator.</p>
        </Section>

        <Section title="3 · Pre-Flight & Safety">
          <ul className="pl-4 space-y-1 list-disc">
            <li>Confirm battery charge and voltage.</li>
            <li>Confirm a GPS 3D fix with an adequate satellite count.</li>
            <li>Check the geofence boundary for your flight area.</li>
            <li>Inspect the airframe and propellers for damage.</li>
            <li>Verify compass/IMU calibration.</li>
            <li>Confirm you&apos;re legally clear to fly there (airspace, altitude limits, proximity to airports).</li>
          </ul>
        </Section>

        <Section title="4 · Failsafes & Emergencies">
          <p><strong className="text-slate-100">GPS loss</strong> — a well-configured aircraft falls back to a safe behavior instead of relying on GPS-dependent modes.</p>
          <p><strong className="text-slate-100">Link/radio loss</strong> — should trigger an automatic RTL after a timeout.</p>
          <p><strong className="text-slate-100">Battery sag</strong> — low-voltage warnings, often followed by an automatic RTL or land.</p>
          <p><strong className="text-slate-100">Kill switch</strong> — an immediate, uncontrolled motor cutoff. Last resort only.</p>
          <p className="text-slate-400">Try all of these yourself in the Simulator&apos;s Failure Injection panel before your checkride.</p>
        </Section>

        <Section title="Ask Your Instructor">
          <GroundSchoolInstructorChat />
        </Section>

        <section className="p-5 border rounded-xl border-slate-800 bg-slate-900/30">
          <h2 className="text-sm font-bold tracking-wide text-cyan-400 uppercase">5 · Knowledge Check</h2>
          <p className="mt-1 mb-4 text-xs text-slate-500">
            Pass {QUIZ_PASS_COUNT}/{QUIZ_QUESTIONS.length} to unlock the solo flight checkride.
          </p>
          <div className="space-y-5">
            {QUIZ_QUESTIONS.map((q, qi) => {
              const userAnswer = progress.quizAnswers[qi];
              return (
                <div key={qi}>
                  <p className="text-sm font-medium text-slate-100">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-1 gap-2 mt-2 sm:grid-cols-2">
                    {q.options.map((opt, oi) => {
                      const isSelected = userAnswer === oi;
                      const isCorrect = oi === q.correctIndex;
                      let stateClass = 'border-slate-700 hover:border-slate-500';
                      if (progress.quizSubmitted) {
                        if (isCorrect) stateClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-200';
                        else if (isSelected) stateClass = 'border-rose-500 bg-rose-500/10 text-rose-200';
                      } else if (isSelected) {
                        stateClass = 'border-cyan-500 bg-cyan-500/10';
                      }
                      return (
                        <button
                          key={oi}
                          onClick={() => setAnswer(qi, oi)}
                          disabled={progress.quizSubmitted}
                          className={`px-3 py-2 text-xs text-left border rounded-lg transition ${stateClass}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-5">
            {!progress.quizSubmitted ? (
              <button
                onClick={submitQuiz}
                disabled={progress.quizAnswers.some((a) => a === null)}
                className="px-4 py-2 text-xs font-bold tracking-wide text-white uppercase rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40"
              >
                Submit Quiz
              </button>
            ) : (
              <>
                <span className={`text-sm font-bold ${quizPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Score: {score}/{QUIZ_QUESTIONS.length} {quizPassed ? '— Passed' : '— Not yet'}
                </span>
                <button onClick={retakeQuiz} className="text-xs underline text-slate-400 hover:text-slate-200">
                  Retake
                </button>
              </>
            )}
          </div>
        </section>

        <section className="p-5 border rounded-xl border-slate-800 bg-slate-900/30">
          <h2 className="text-sm font-bold tracking-wide text-cyan-400 uppercase">6 · Solo Flight Checkride</h2>
          <p className="mt-1 mb-4 text-xs text-slate-500">
            Open the simulator, fly each task below, then check it off here.
          </p>
          <a
            href="/flight-school/simulator"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 mb-4 text-xs font-bold tracking-wide text-white uppercase rounded-lg bg-purple-600 hover:bg-purple-500"
          >
            Launch Simulator
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="space-y-2">
            {CHECKRIDE_TASKS.map((task, i) => (
              <button
                key={i}
                onClick={() => toggleTask(i)}
                className="flex items-center w-full gap-2.5 text-left text-sm text-slate-200"
              >
                {progress.checklist[i] ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <span className={progress.checklist[i] ? 'line-through text-slate-500' : ''}>{task}</span>
              </button>
            ))}
          </div>
        </section>

        {certificateUnlocked && (
          <section
            id="certificate"
            className="relative p-8 overflow-hidden text-center border-2 rounded-2xl border-amber-400/40 bg-gradient-to-b from-amber-500/10 to-slate-900/40"
          >
            <Award className="w-10 h-10 mx-auto text-amber-300" />
            <p className="mt-3 text-xs tracking-[0.3em] text-amber-300 uppercase">Ai One Ground School</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Solo Flight Certificate of Completion</h2>
            <input
              value={progress.pilotName}
              onChange={(e) => setProgress({ ...progress, pilotName: e.target.value })}
              placeholder="Your name"
              className="w-full max-w-xs px-3 py-2 mx-auto mt-4 text-sm text-center bg-transparent border-b outline-none border-slate-600 text-slate-100 placeholder-slate-600 focus:border-amber-400"
            />
            <p className="mt-3 text-sm text-slate-300">
              has completed Ground School with a score of {score}/{QUIZ_QUESTIONS.length} and finished the solo
              flight checkride.
            </p>
            <p className="mt-1 text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
            <p className="max-w-md mx-auto mt-4 text-[11px] text-slate-500">
              This is a personal-accomplishment badge, not a real FAA credential. It does not satisfy TRUST or Part
              107 requirements.
            </p>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 mt-5 text-xs font-bold tracking-wide text-black uppercase rounded-lg bg-amber-400 hover:bg-amber-300"
            >
              Print / Save Certificate
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
