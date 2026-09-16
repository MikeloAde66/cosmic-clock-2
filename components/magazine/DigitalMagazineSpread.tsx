'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Satellite,
  LineChart,
  Terminal,
  Sun,
  Orbit,
  CalendarDays,
  SatelliteDish,
  SlidersHorizontal,
} from 'lucide-react';
import Starfield from '@/components/Starfield';
import RadarCanvas from './RadarCanvas';
import type { SpreadConfig, RadarTarget, LocationOption } from '@/lib/spreads/types';

type ViewName = 'landing' | 'feed' | 'telemetry';

const QUICK_FILTER_ICONS = [Satellite, Sun, Orbit, CalendarDays];

// Renders any SpreadConfig — Star Tracker today; geology, ancient history,
// and climate telemetry spreads reuse this same component with their own
// config object (see lib/spreads/types.ts). Radar sweep / target rotation
// / stat+ticker jitter are the FX this template guarantees; everything
// else (copy, targets, telemetry rows) is data.
export default function DigitalMagazineSpread({ config }: { config: SpreadConfig }) {
  const [view, setView] = useState<ViewName>('landing');
  // Placeholder, not new Date() — computing a real time in the initializer
  // runs once at SSR and again at hydration, producing two different
  // strings and a hydration mismatch (same class of bug Starfield.tsx's
  // own seeded-PRNG comment documents avoiding). The real values are set
  // client-side only, in the effect below.
  const [clockValues, setClockValues] = useState<string[]>(() => config.clocks.map(() => '--:--:--'));
  const [selectedTarget, setSelectedTarget] = useState<RadarTarget>(config.feed.targets[0]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>(config.feed.locations[0]);
  const [statValues, setStatValues] = useState(() =>
    config.telemetry.stats.map((s) => ({ value: s.initialValue, barPercent: s.initialBarPercent ?? 50 }))
  );
  const [rowValues, setRowValues] = useState(() =>
    config.telemetry.rows.map((r) => ({ value: r.liveValueInitial, subtitle: r.liveSubtitleInitial }))
  );
  const [sessionSeconds, setSessionSeconds] = useState(31);
  const [typedText, setTypedText] = useState('');
  const [devDockActive, setDevDockActive] = useState(true);

  useEffect(() => {
    document.title = config.pageTitle;
  }, [config.pageTitle]);

  // Header clocks — set immediately on mount (client-only, past the
  // hydration point above), then one shared 1s tick after that.
  useEffect(() => {
    const tick = () => setClockValues(config.clocks.map((c) => c.compute(new Date())));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.clocks]);

  // Session runtime timer — cosmetic, matches the original's fixed 31s start.
  useEffect(() => {
    const id = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Stat-tile jitter (e.g. latency) — each tile supplies its own jitter fn;
  // tiles without one just keep their initial value.
  useEffect(() => {
    if (config.telemetry.stats.every((s) => !s.jitter)) return;
    const id = setInterval(() => {
      setStatValues((prev) =>
        config.telemetry.stats.map((s, i) => {
          if (!s.jitter) return prev[i];
          const r = s.jitter();
          return { value: r.value, barPercent: r.barPercent ?? prev[i].barPercent };
        })
      );
    }, config.telemetry.statsIntervalMs);
    return () => clearInterval(id);
  }, [config.telemetry.stats, config.telemetry.statsIntervalMs]);

  // DSN-style ticker rows jitter on their own (slower) cadence.
  useEffect(() => {
    if (config.telemetry.rows.every((r) => !r.liveValueJitter && !r.liveSubtitleJitter)) return;
    const id = setInterval(() => {
      setRowValues((prev) =>
        config.telemetry.rows.map((r, i) => ({
          value: r.liveValueJitter ? r.liveValueJitter() : prev[i].value,
          subtitle: r.liveSubtitleJitter ? r.liveSubtitleJitter() : prev[i].subtitle,
        }))
      );
    }, config.telemetry.rowsIntervalMs);
    return () => clearInterval(id);
  }, [config.telemetry.rows, config.telemetry.rowsIntervalMs]);

  // AI hook typewriter — cycles through config.aiHook.prompts.
  useEffect(() => {
    const prompts = config.aiHook.prompts;
    if (prompts.length === 0) return;
    let promptIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const current = prompts[promptIdx].text;
      if (isDeleting) {
        setTypedText(current.substring(0, charIdx - 1));
        charIdx--;
      } else {
        setTypedText(current.substring(0, charIdx + 1));
        charIdx++;
      }

      let speed = isDeleting ? 25 : 55;
      if (!isDeleting && charIdx === current.length) {
        speed = 2200;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        promptIdx = (promptIdx + 1) % prompts.length;
        speed = 400;
      }
      timeoutId = setTimeout(tick, speed);
    }
    tick();
    return () => clearTimeout(timeoutId);
  }, [config.aiHook.prompts]);

  const sessionLabel = `00:${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`;
  const viewClass = (name: ViewName) =>
    `w-full view-transition ${view === name ? 'opacity-100' : 'hidden opacity-0'}`;

  return (
    <div className="relative min-h-screen flex flex-col font-mono text-slate-200 selection:bg-cyan-500 selection:text-black overflow-x-hidden bg-[#030712]">
      <Starfield />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundSize: '40px 40px',
          backgroundImage:
            'linear-gradient(to right, rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.03) 1px, transparent 1px)',
        }}
      />
      <div
        className="fixed inset-0 z-10 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,240,255,0.02) 50%, rgba(0,240,255,0.02))',
          backgroundSize: '100% 4px',
        }}
      />

      <header className="relative z-20 border-b border-cyan-500/20 bg-black/70 backdrop-blur-md px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between text-xs">
        <div className="flex items-center space-x-6">
          <Link
            href={config.backHref}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {config.backLabel}
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-cyan-400/90 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              {config.liveBadgeLabel}: <strong className="text-cyan-300">{config.liveBadgeValue}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-300 mt-2 sm:mt-0">
          {config.clocks.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <div className="h-6 w-px bg-cyan-500/30" />}
              <div className="text-right">
                <span className="text-slate-500 block text-[10px]">{c.label}</span>
                <span className={i === 0 ? 'text-cyan-400 font-bold tracking-widest' : 'text-slate-200 font-semibold tracking-wider'}>
                  {clockValues[i]}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </header>

      <main className="relative z-20 flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* LANDING */}
        <section className={viewClass('landing')}>
          <div className="max-w-3xl space-y-6 pt-4">
            <div className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 uppercase">
              {config.heroTag}
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white uppercase leading-none">
              {config.heroLines.map((line, i) => (
                <span key={i}>
                  {i === config.heroHighlightIndex ? (
                    <span
                      className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400"
                      style={{ textShadow: '0 0 14px rgba(0,240,255,0.75), 0 0 28px rgba(0,240,255,0.3)' }}
                    >
                      {line}
                    </span>
                  ) : (
                    line
                  )}
                  {i < config.heroLines.length - 1 && <br />}
                </span>
              ))}
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl">{config.heroBody}</p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => setView('feed')}
                className="px-6 py-3.5 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs md:text-sm tracking-widest uppercase rounded shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 transition-all duration-200 active:scale-95 flex items-center gap-2 border border-cyan-300"
              >
                <Satellite className="w-4 h-4" /> {config.ctaFeedLabel}
              </button>
              <button
                onClick={() => setView('telemetry')}
                className="px-6 py-3.5 bg-slate-950/80 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 font-bold text-xs md:text-sm tracking-widest uppercase rounded transition-all duration-200 active:scale-95 flex items-center gap-2"
              >
                <LineChart className="w-4 h-4" /> {config.ctaTelemetryLabel}
              </button>
            </div>
          </div>

          <div className="dev-tool-panel p-5 rounded-xl border border-cyan-500/40 space-y-4 max-w-3xl mt-8">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold text-cyan-300 tracking-wider">{config.aiHook.badge}</span>
              </div>
              <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded">
                {config.aiHook.readyLabel}
              </span>
            </div>

            <div className="bg-black/90 p-3.5 rounded border border-cyan-500/20 text-xs text-cyan-300 min-h-[48px] flex items-center">
              <span className="text-cyan-500 mr-2">&gt;</span>
              <span>{typedText}</span>
              <span className="animate-pulse text-cyan-400">|</span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                SELECT SAMPLE PROMPT TO TEST KALI:
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {config.aiHook.prompts.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setTypedText(p.text)}
                    className="px-2.5 py-1.5 bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-200 rounded text-left transition-all"
                  >
                    <Terminal className="inline w-2.5 h-2.5 text-cyan-400 mr-1" /> {p.tag} {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-8">
            {config.featureCards.map((card) => (
              <div
                key={card.title}
                className="dev-tool-panel p-5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
              >
                <div className="text-cyan-400 font-semibold text-xs mb-2">{card.title}</div>
                <p className="text-slate-200 text-xs leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEED */}
        <section className={`${viewClass('feed')} flex-1 flex flex-col space-y-4`}>
          <div className="dev-tool-panel p-4 rounded-xl border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-cyan-400 text-[10px] tracking-widest block uppercase">{config.feed.kicker}</span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                {config.feed.title}
                <span className="text-xs text-slate-400 font-normal">{selectedLocation.detail}</span>
              </h2>
            </div>
            <select
              value={selectedLocation.id}
              onChange={(e) => {
                const next = config.feed.locations.find((l) => l.id === e.target.value);
                if (next) setSelectedLocation(next);
              }}
              className="bg-black/90 border border-cyan-500/40 text-cyan-300 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {config.feed.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {config.feed.quickFilters.map((label, i) => {
              const Icon = QUICK_FILTER_ICONS[i % QUICK_FILTER_ICONS.length];
              return (
                <button
                  key={label}
                  className="px-3 py-1 bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 rounded flex items-center gap-1.5"
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full h-[540px] rounded-xl border border-cyan-500/40 overflow-hidden shadow-2xl bg-black">
            <RadarCanvas
              targets={config.feed.targets}
              selectedTarget={selectedTarget}
              onSelectTarget={setSelectedTarget}
              compassLabels={config.feed.compassLabels}
              className="w-full h-full cursor-crosshair"
            />

            <div className="absolute top-4 left-4 bg-black/85 border border-cyan-500/40 rounded-lg p-3 text-xs text-cyan-300 backdrop-blur-md">
              <div className="font-bold text-white text-sm">{selectedTarget.name}</div>
              <div className="text-[11px] text-cyan-400/90 mt-0.5">{selectedTarget.info}</div>
            </div>

            <div className="absolute top-4 right-4 bg-black/85 border border-cyan-500/40 rounded px-3 py-1 text-[11px] text-cyan-300 backdrop-blur-sm">
              1.0x · FOV 180°
            </div>

            <div className="absolute bottom-4 left-4 text-[10px] text-slate-400 bg-black/70 px-3 py-1.5 rounded-md border border-slate-800 backdrop-blur-sm">
              {config.feed.hint}
            </div>
          </div>
        </section>

        {/* TELEMETRY */}
        <section className={`${viewClass('telemetry')} flex-1 flex flex-col space-y-6`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {config.telemetry.stats.map((stat, i) => (
              <div key={stat.id} className="dev-tool-panel p-4 rounded-xl border border-cyan-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span>{stat.label}</span>
                    <span className="ticker-glow text-emerald-400 font-bold text-base">{statValues[i].value}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-300"
                      style={{ width: `${statValues[i].barPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0ms</span>
                    <span>250ms</span>
                    <span>500ms+</span>
                  </div>
                </div>
                <div className="text-[11px] text-cyan-400/80 mt-4 border-t border-cyan-500/10 pt-2 flex items-center justify-between">
                  <span>{stat.footerLabel}</span>
                  <span className="text-white">{stat.footerValue}</span>
                </div>
              </div>
            ))}

            <div className="dev-tool-panel p-4 rounded-xl border border-cyan-500/30 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-400 block">SIGNAL STABILITY</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE STREAM ACTIVE
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] rounded font-bold">
                  CONNECTED
                </span>
              </div>
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-1">SIGNAL STRENGTH</div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                  <div className="signal-bar-fill bg-emerald-400 h-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
              </div>
              <div className="text-[11px] text-cyan-400/80 mt-4 border-t border-cyan-500/10 pt-2 flex items-center justify-between">
                <span>PROTOCOL:</span>
                <span className="text-cyan-300">WSS / JSON-RPC</span>
              </div>
            </div>

            <div className="dev-tool-panel p-4 rounded-xl border border-cyan-500/30 text-center flex flex-col justify-between">
              <span className="text-xs text-slate-400 block">SESSION RUNTIME</span>
              <div className="text-3xl font-extrabold text-cyan-300 tracking-wider my-1">{sessionLabel}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                EXECUTION STATE: <span className="text-emerald-400 font-bold">LOGGING ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="dev-tool-panel rounded-xl border border-cyan-500/30 overflow-hidden">
            <div className="px-4 py-3 bg-cyan-950/40 border-b border-cyan-500/20 text-xs text-cyan-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <SatelliteDish className="w-3.5 h-3.5" /> {config.telemetry.sourceLabel}
              </span>
              <span className="text-[10px] text-slate-400">{config.telemetry.sourceSubLabel}</span>
            </div>

            <div className="divide-y divide-cyan-500/10 text-xs">
              {config.telemetry.rows.map((row, i) => (
                <div
                  key={row.id}
                  className={`p-4 flex flex-wrap items-center justify-between gap-4 ${row.highlighted ? 'bg-cyan-950/20' : ''}`}
                >
                  <div>
                    <span className="text-cyan-400 font-bold text-sm">{row.leftTitle}</span>
                    <div className="text-[10px] text-slate-500">{row.leftSubtitle}</div>
                  </div>
                  <div className="text-right">
                    <div className={row.highlighted ? 'text-cyan-300 font-bold' : 'text-slate-300'}>
                      {row.rightTitle}
                      {row.liveValueId && (
                        <>
                          {' · '}
                          <span className="ticker-glow text-emerald-400">{rowValues[i].value}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {row.liveSubtitleId && <span className="ticker-glow">{rowValues[i].subtitle}</span>}
                      {row.liveSubtitleId && ' · '}
                      {row.rightSubtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-4 right-4 z-50">
        <div className="dev-tool-panel rounded-xl p-3 shadow-2xl border border-cyan-500/50 text-xs space-y-2 w-72">
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" /> PROTOLABS DEV DOCK
            </span>
            <span className="text-[9px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">PREVIEW</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] text-slate-400 block uppercase font-bold">Route View Switcher:</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setView('landing')}
                className="px-2 py-1 bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 rounded text-[10px]"
              >
                Overview
              </button>
              <button
                onClick={() => setView('feed')}
                className="px-2 py-1 bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 rounded text-[10px]"
              >
                Sky Feed
              </button>
              <button
                onClick={() => setView('telemetry')}
                className="px-2 py-1 bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 rounded text-[10px]"
              >
                Telemetry
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Animate Skill Overlay:</span>
            <button
              onClick={() => setDevDockActive((v) => !v)}
              className={
                devDockActive
                  ? 'px-2.5 py-1 bg-cyan-500 text-black font-bold rounded hover:bg-cyan-400'
                  : 'px-2.5 py-1 bg-slate-800 text-slate-400 rounded'
              }
            >
              {devDockActive ? 'Active' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .dev-tool-panel {
          backdrop-filter: blur(14px);
          background: rgba(4, 9, 20, 0.92);
          border: 1px solid rgba(0, 240, 255, 0.25);
        }
        .view-transition {
          transition: opacity 0.35s ease-in-out, transform 0.35s ease-in-out;
        }
        @keyframes signalFlicker {
          0%, 100% { opacity: 1; width: 84%; }
          4% { opacity: 0.5; width: 70%; }
          8% { opacity: 1; width: 84%; }
          22% { opacity: 0.6; width: 76%; }
          24% { opacity: 1; width: 88%; }
          47% { opacity: 0.4; width: 65%; }
          49% { opacity: 1; width: 84%; }
          71% { opacity: 0.7; width: 80%; }
          73% { opacity: 1; width: 90%; }
        }
        .signal-bar-fill {
          animation: signalFlicker 4s infinite steps(1, end);
        }
        @keyframes tickerGlowPulse {
          0%, 100% { text-shadow: 0 0 4px currentColor; opacity: 0.85; }
          50% { text-shadow: 0 0 12px currentColor, 0 0 4px currentColor; opacity: 1; }
        }
        .ticker-glow {
          animation: tickerGlowPulse 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
