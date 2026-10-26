'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Home, ListChecks, Orbit } from 'lucide-react';
import FlightStick from './FlightStick';
import Led from './Led';
import type { LedState } from './Led';
import ModeBadge from './ModeBadge';
import { WHO, clock } from './CockpitHud';
import type { RadioLine } from '@/lib/astroSim/droneMission';

// The canopy cockpit, built from the design mockup at 1440x900. Layout is in
// that coordinate system and scaled to the live viewport: a header crossbeam
// across the top with the title plate, radio transmission widget and switches;
// the comms log and objective gauge floating on the glass; and a console
// shelf along the bottom. The sides stay open to the starfield and Moon.

export const TEAL = '#5ee9d4';
export const EDGE = '#2a3338';
export const PANEL = '#0c1113';
export const LABEL = '#577b76';
export const LABEL2 = '#7fb3ac';
export const TEXT = '#eafffb';
const REF_W = 1440;

const CSS = `
@keyframes cn-breathe { 0%,100% { opacity: var(--lo,.5) } 50% { opacity: var(--hi,.7) } }
@keyframes cn-fault { 0% { opacity: 1 } 50% { opacity: .15 } }
@keyframes cn-bar { 0%,100% { height: calc(var(--h) * .3) } 50% { height: var(--h) } }
@keyframes cn-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@keyframes cn-grain { 0% { transform: translate(0,0) } 20% { transform: translate(-3%,2%) } 40% { transform: translate(2%,-3%) } 60% { transform: translate(-2%,-1%) } 80% { transform: translate(3%,3%) } 100% { transform: translate(0,0) } }
@keyframes cn-glare { 0% { transform: translateX(-30%) } 100% { transform: translateX(130%) } }
.cn-breathe { animation: cn-breathe var(--d,3s) ease-in-out infinite }
.cn-fault { animation: cn-fault var(--d,1s) steps(1,end) infinite }
.cn-bar { animation: cn-bar var(--bd,.7s) ease-in-out var(--bo,0s) infinite }
.cn-in { animation: cn-in .6s ease-out }
.cn-grain { animation: cn-grain .9s steps(5) infinite }
.cn-glare { animation: cn-glare 26s linear infinite }
.cn-btn { font-family: inherit; cursor: pointer; background: #1a2024; border: 1px solid #39434b; color: #bfe9e4; letter-spacing: .06em }
.cn-btn:hover { border-color: ${TEAL} }
.cn-btn:focus-visible { outline: 2px solid ${TEAL}; outline-offset: 2px }
@media (prefers-reduced-motion: reduce) { .cn-breathe, .cn-fault, .cn-bar, .cn-in, .cn-grain, .cn-glare { animation: none !important } }
`;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// 9-bar equaliser: peak heights (% of 22px) and the bar colours from the mockup.
const BARS: [number, string, boolean][] = [
  [40, '#2f8f80', false],
  [70, '#45b4a2', false],
  [95, TEAL, true],
  [55, '#45b4a2', false],
  [80, TEAL, true],
  [35, '#2f8f80', false],
  [60, '#45b4a2', false],
  [90, TEAL, true],
  [45, '#2f8f80', false],
];

function RadioXmit({ live, lost }: { live: boolean; lost: boolean }) {
  const status = lost ? 'NO SIGNAL' : live ? 'ON AIR' : 'STANDBY';
  const color = lost ? '#fb7185' : TEAL;
  const led: LedState = lost ? 'fault' : live ? 'active' : 'standby';
  return (
    <div
      style={{
        position: 'absolute', left: 500, top: 13, width: 270, height: 66,
        background: '#0b1012', border: `1px solid ${EDGE}`, borderRadius: 3, padding: '7px 14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, letterSpacing: '.14em', color: LABEL }}>RADIO XMIT</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, letterSpacing: '.1em', color }}>
          <Led color={color} state={led} />
          {status}
        </span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
        {BARS.map(([h, c, glow], i) => {
          const px = (h / 100) * 22;
          return (
            <span
              key={i}
              className={live && !lost ? 'cn-bar' : ''}
              style={{
                width: 4, height: live && !lost ? undefined : Math.max(2, px * 0.2), background: lost ? '#3a2a2e' : c, borderRadius: 1,
                boxShadow: glow && live && !lost ? '0 0 5px rgba(94,233,212,.6)' : 'none',
                ['--h' as string]: `${px}px`, ['--bd' as string]: `${0.5 + ((i * 37) % 40) / 100}s`, ['--bo' as string]: `-${(i * 0.11).toFixed(2)}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 9, letterSpacing: '.06em', color: LABEL }}>121.500 MHz &middot; SHACKLETON RELAY</div>
    </div>
  );
}

function Tape({ heading }: { heading: number }) {
  const labels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  const span = 90; // degrees across the 400px tape
  const items: { deg: number; x: number }[] = [];
  for (let d = -span; d <= span; d += 10) {
    const abs = (Math.round(heading / 10) * 10 + d + 360) % 360;
    const off = ((abs - heading + 540) % 360) - 180;
    items.push({ deg: abs, x: 50 + (off / span) * 50 });
  }
  return (
    <div style={{ position: 'absolute', left: 520, top: 40, width: 400, height: 44, background: '#0c1113', border: `1px solid ${EDGE}`, borderRadius: 3, overflow: 'hidden' }} aria-label={`Heading ${Math.round(heading)}`}>
      {items.map((it, i) => (
        <div key={i} style={{ position: 'absolute', top: 6, left: `${it.x}%`, transform: 'translateX(-50%)', textAlign: 'center', fontSize: 11, color: labels[it.deg] ? TEAL : '#7fb3ac', fontWeight: labels[it.deg] ? 700 : 400, transition: 'left 500ms linear' }}>
          <div style={{ width: 1, height: it.deg % 30 === 0 ? 8 : 4, margin: '0 auto 3px', background: it.deg % 30 === 0 ? '#9bc4bf' : '#3a4a4d' }} />
          {it.deg % 30 === 0 && (labels[it.deg] ?? it.deg)}
        </div>
      ))}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: '100%', background: '#eab308', transform: 'translateX(-50%)' }} />
    </div>
  );
}

function Tele({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 3, padding: '7px 10px' }}>
      <div style={{ fontSize: 8, letterSpacing: '.1em', color: LABEL }}>{label}</div>
      <div style={{ fontSize: 15, color: warn ? '#fb7185' : TEXT }}>
        {value}
        {unit && <span style={{ fontSize: 9, color: LABEL2 }}> {unit}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, color, state }: { label: string; color: string; state: LedState }) {
  return (
    <div className="cn-btn" style={{ borderRadius: 3, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'default' }}>
      <Led color={color} state={state} size={5} />
      {label}
    </div>
  );
}

/** Everything the canopy shell needs to draw one mission's cockpit. */
export interface CanopyView {
  title: { eyebrow: string; name: string };
  heading: number;
  sunGlow: number;
  /** mission clock, seconds */
  t: number;
  throttle: number;
  linkLost: boolean;
  objective: { title: string; status: string; fill: number };
  speed: { label: string; value: string; sub: string; tone?: 'ok' | 'warn' | 'bad' };
  /** exactly eight cells */
  tele: { label: string; value: string; unit?: string; warn?: boolean }[];
  /** the whole small screen to the right of the telemetry grid */
  nav: ReactNode;
  /** up to three switches in the crossbeam */
  buttons: { label: string; onClick: () => void; led: LedState; pressed?: boolean }[];
  /** the eight indicator lights */
  toggles: { label: string; color: string; state: LedState }[];
  done: null | { kicker: string; title: string; text: string; tone?: 'good' | 'bad'; actions: { label: string; onClick: () => void }[] };
  controls: { caption: string; left: string; right: string };
}

/** The frame for the small screen right of the telemetry grid. */
export function NavPanel({ label, sub, children }: { label: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: 1100, top: 100, width: 110, height: 142, background: '#070b0c', border: `1px solid ${EDGE}`, borderRadius: 3, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 8, letterSpacing: '.1em', color: LABEL, alignSelf: 'flex-start' }}>{label}</div>
      <div aria-hidden="true" style={{ position: 'relative', width: 88, height: 70, marginTop: 4 }}>{children}</div>
      <div style={{ fontSize: 8, letterSpacing: '.06em', color: LABEL2, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const TONE = { ok: TEAL, warn: '#eab308', bad: '#fb7185' } as const;

export default function CanopyShell({
  view,
  log,
  onLeft,
  onRight,
  onMissions,
}: {
  view: CanopyView;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onMissions: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setS(Math.max(0.6, Math.min(1.2, Math.min(width / REF_W, height / 720))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const last = log[log.length - 1];
  const live = !!last && view.t - last.at < 6 && !view.linkLost;
  const stage = (h: number, edge: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: '50%',
    [edge]: 0,
    width: REF_W,
    height: h,
    transform: `translateX(-50%) scale(${s})`,
    transformOrigin: edge === 'top' ? '50% 0' : '50% 100%',
  });
  const sy = (n: number) => `${(n * s).toFixed(1)}px`;
  const xp = (n: number) => `${((n / REF_W) * 100).toFixed(3)}%`;
  const commsLed: LedState = view.linkLost ? 'fault' : 'active';
  const done = view.done;
  const doneColor = done?.tone === 'bad' ? '#fb7185' : TEAL;

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace", color: '#cfeceb', lineHeight: 'normal' }}>
      <style>{CSS}</style>

      {/* ---- cinema layers (beneath the hardware) ---- */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 48%, rgba(0,0,0,.55) 92%)' }} />
      <div className="absolute inset-0 mix-blend-screen" style={{ opacity: view.sunGlow * 0.85, transition: 'opacity 600ms ease', background: 'radial-gradient(circle at 62% 30%, rgba(255,232,190,0.95) 0%, rgba(255,190,110,0.35) 28%, rgba(255,160,80,0) 62%)' }} />
      <div className="absolute inset-[-10%] cn-grain mix-blend-overlay opacity-[0.07]" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 overflow-hidden opacity-[0.05]">
        <div className="absolute inset-y-0 w-1/3 cn-glare" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.9), transparent)' }} />
      </div>

      {/* ---- header crossbeam (full width) ---- */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: sy(92), background: 'linear-gradient(180deg,#0f1316 0%,#171d21 55%,#0c1012 100%)', borderBottom: '2px solid #060809', boxShadow: '0 10px 30px rgba(0,0,0,.6)' }}>
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 2, background: 'linear-gradient(90deg,transparent,rgba(94,233,212,.5) 30%,rgba(94,233,212,.5) 70%,transparent)' }} />
        {[14, 70].map((t) => (
          <span key={t}>
            <span style={{ position: 'absolute', left: sy(24), top: sy(t), width: 4, height: 4, borderRadius: '50%', background: '#3a444a' }} />
            <span style={{ position: 'absolute', right: sy(24), top: sy(t), width: 4, height: 4, borderRadius: '50%', background: '#3a444a' }} />
          </span>
        ))}
      </div>

      {/* ---- console shelf (full width) ---- */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: sy(300),
          clipPath: `polygon(0 ${sy(60)}, ${xp(260)} ${sy(28)}, 50% ${sy(8)}, ${xp(1180)} ${sy(28)}, 100% ${sy(60)}, 100% 100%, 0 100%)`,
          background: 'linear-gradient(180deg,#171d21 0%,#101416 30%,#0a0d0f 100%)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: sy(244), height: sy(2),
          clipPath: `polygon(0 ${sy(4)}, ${xp(260)} 0, 50% 0, ${xp(1180)} 0, 100% ${sy(4)}, 100% ${sy(8)}, 0 ${sy(8)})`,
          background: 'linear-gradient(90deg,transparent,rgba(94,233,212,.4) 25%,rgba(94,233,212,.4) 75%,transparent)',
        }}
      />

      {/* ---- top stage: crossbeam contents, comms log, objective ---- */}
      <div style={stage(340, 'top')}>
        <div style={{ position: 'absolute', left: 210, top: 18, padding: '8px 16px', background: '#121719', border: '1px solid #30383d', borderRadius: 3 }}>
          <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#6fb8b0' }}>{view.title.eyebrow}</div>
          <div style={{ fontSize: 16, letterSpacing: '.04em', color: TEXT, marginTop: 2 }}>{view.title.name}</div>
        </div>

        <RadioXmit live={live} lost={view.linkLost} />

        <div style={{ position: 'absolute', right: 220, top: 20, display: 'flex', gap: 10 }} className="pointer-events-auto">
          {view.buttons.map((b) => (
            <button key={b.label} type="button" className="cn-btn" onClick={b.onClick} aria-pressed={b.pressed} style={{ padding: '9px 14px', borderRadius: 3, fontSize: 11, display: 'flex', alignItems: 'center', gap: 7, ...(b.pressed ? { borderColor: TEAL, color: TEXT } : {}) }}>
              <Led color={b.led === 'off' && !b.pressed ? '#5a656c' : TEAL} state={b.led} />
              {b.label}
            </button>
          ))}
        </div>

        {/* the site's own links, kept in the crossbeam's open right end */}
        <div style={{ position: 'absolute', right: 24, top: 25, display: 'flex', alignItems: 'center', gap: 6 }} className="pointer-events-auto">
          <ModeBadge mode="SIM" note="Simulated vehicle and flight, Moon not to scale. The Moon surface is NASA imagery." />
          <button type="button" aria-label="Missions" title="Missions" onClick={onMissions} className="cn-btn" style={{ width: 32, height: 32, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ListChecks style={{ width: 16, height: 16 }} />
          </button>
          <Link href="/astro-sim" aria-label="Observatory" title="Observatory" className="cn-btn" style={{ width: 32, height: 32, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Orbit style={{ width: 16, height: 16 }} />
          </Link>
          <Link href="/" aria-label="Home" title="Home" className="cn-btn" style={{ width: 32, height: 32, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home style={{ width: 16, height: 16 }} />
          </Link>
        </div>

        {/* comms log */}
        <div style={{ position: 'absolute', left: 46, top: 150, width: 360, background: 'rgba(8,14,16,.72)', border: '1px solid rgba(94,233,212,.35)', borderRadius: 4, padding: '14px 16px', boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.12em', color: view.linkLost ? '#fb7185' : TEAL, borderBottom: '1px solid rgba(94,233,212,.25)', paddingBottom: 8, marginBottom: 8 }}>
            <Led color={view.linkLost ? '#fb7185' : '#34d399'} state={commsLed} size={7} />
            {view.linkLost ? 'COMMS · NO SIGNAL · FAR SIDE' : 'COMMS · CH 1'}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: '#cfeceb' }}>
            {log.slice(-3).map((l, idx, arr) => {
              const age = arr.length - 1 - idx;
              return (
                <div key={l.id} className="cn-in" style={{ marginBottom: age === 0 ? 0 : 8, opacity: age === 0 ? 1 : age === 1 ? 0.65 : 0.42 }}>
                  <span style={{ color: WHO[l.who].color }}>{WHO[l.who].tag} {clock(l.at)}</span> {l.text}
                </div>
              );
            })}
            {log.length === 0 && <div style={{ color: LABEL }}>Standing by…</div>}
          </div>
        </div>

        {/* objective gauge */}
        <div style={{ position: 'absolute', right: 46, top: 150, width: 380, background: 'rgba(8,14,16,.72)', border: '1px solid rgba(94,233,212,.35)', borderRadius: 4, padding: '12px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '.14em', color: '#8fb6b2' }}>{view.objective.title}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: TEXT }}>{view.objective.status}</div>
          <div style={{ marginTop: 8, height: 4, background: '#1a2a29', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, Math.round(view.objective.fill * 100))}%`, height: '100%', background: TEAL, transition: 'width 600ms ease' }} />
          </div>
        </div>
      </div>

      {done && (
        <div className="absolute inset-x-0 flex justify-center top-[34%]">
          <div className="pointer-events-auto" style={{ background: 'rgba(8,14,16,.88)', border: `1px solid ${doneColor}73`, borderRadius: 4, padding: '20px 34px', textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontSize: 10, letterSpacing: '.3em', color: LABEL2 }}>{done.kicker}</div>
            <div style={{ fontSize: 22, letterSpacing: '.2em', color: doneColor, marginTop: 4 }}>{done.title}</div>
            <div style={{ fontSize: 11, color: LABEL2, marginTop: 4, lineHeight: 1.5 }}>{done.text}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12 }}>
              {done.actions.map((a) => (
                <button key={a.label} type="button" className="cn-btn" onClick={a.onClick} style={{ padding: '8px 16px', borderRadius: 3, fontSize: 11, letterSpacing: '.14em' }}>{a.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- bottom stage: the console ---- */}
      <div style={stage(300, 'bottom')}>
        <Tape heading={view.heading} />
        <div style={{ position: 'absolute', left: 520, top: 88, width: 262, textAlign: 'center', fontSize: 9, letterSpacing: '.06em', color: LABEL, whiteSpace: 'nowrap' }}>
          {view.controls.caption}
        </div>

        {/* thrust meter */}
        <div style={{ position: 'absolute', left: 700, top: 100, width: 40, height: 150, background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }} aria-label={`Throttle ${Math.round(view.throttle * 100)} percent`}>
          <div style={{ height: `${Math.round(view.throttle * 100)}%`, background: 'linear-gradient(180deg,#5ee9d4,#1b7a6c)', transition: 'height 500ms ease' }} />
        </div>
        <div style={{ position: 'absolute', left: 688, top: 258, width: 64, textAlign: 'center', fontSize: 9, letterSpacing: '.08em', color: LABEL }}>THR {Math.round(view.throttle * 100)}%</div>

        {/* grips */}
        <div style={{ position: 'absolute', left: 70, top: 82 }}>
          <FlightStick variant="grip" side="left" label={view.controls.left} color={TEAL} onChange={onLeft} />
        </div>
        <div style={{ position: 'absolute', right: 70, top: 82 }}>
          <FlightStick variant="grip" side="right" label={view.controls.right} color={TEAL} onChange={onRight} />
        </div>

        {/* digital speedometer */}
        <div style={{ position: 'absolute', left: 250, top: 106, width: 220, height: 104, background: '#0a0f10', border: `1px solid ${EDGE}`, borderRadius: 3, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} aria-label={`${view.speed.label} ${view.speed.value}`}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', color: LABEL }}>{view.speed.label}</div>
          <div style={{ fontSize: 34, lineHeight: 1, color: TONE[view.speed.tone ?? 'ok'], textShadow: '0 0 10px currentColor', letterSpacing: '.02em', transition: 'color 300ms' }}>{view.speed.value}</div>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: LABEL2 }}>{view.speed.sub}</div>
        </div>

        {view.nav}

        {/* telemetry grid */}
        <div style={{ position: 'absolute', left: 790, top: 93, width: 300, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }} aria-label="Flight data">
          {view.tele.map((c) => (
            <Tele key={c.label} label={c.label} value={c.value} unit={c.unit} warn={c.warn} />
          ))}
        </div>

        {/* indicator row */}
        <div aria-hidden="true" style={{ position: 'absolute', left: 260, top: 230, display: 'grid', gridTemplateColumns: 'repeat(4,56px)', gridTemplateRows: 'repeat(2,30px)', gap: 6 }}>
          {view.toggles.map((t) => (
            <Toggle key={t.label} label={t.label} color={t.color} state={t.state} />
          ))}
        </div>
      </div>

      {/* scanlines */}
      <div aria-hidden="true" className="absolute inset-0" style={{ opacity: 0.05, backgroundImage: 'repeating-linear-gradient(180deg,#fff 0,#fff 1px,transparent 1px,transparent 3px)' }} />
    </div>
  );
}
