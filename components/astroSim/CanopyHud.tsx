'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Home, Orbit } from 'lucide-react';
import type { DroneHud } from './DroneScene';
import FlightStick from './FlightStick';
import Led from './Led';
import type { LedState } from './Led';
import ModeBadge from './ModeBadge';
import { WHO, clock, objective } from './CockpitHud';
import type { RadioLine } from '@/lib/astroSim/droneMission';

// The canopy cockpit, built from the design mockup at 1440x900. Layout is in
// that coordinate system and scaled to the live viewport: a header crossbeam
// across the top with the title plate, radio transmission widget and switches;
// the comms log and objective gauge floating on the glass; and a console
// shelf along the bottom. The sides stay open to the starfield and Moon.

const TEAL = '#5ee9d4';
const EDGE = '#2a3338';
const PANEL = '#0c1113';
const LABEL = '#577b76';
const LABEL2 = '#7fb3ac';
const TEXT = '#eafffb';
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

// The little orbit map: the body in the middle, two tilted rings, and the
// drone as an amber dot travelling the outer ring as the lap progresses.
function OrbitNav({ lap, hidden }: { lap: number; hidden: boolean }) {
  const phi = (-12 * Math.PI) / 180;
  const theta = (-139 * Math.PI) / 180 + lap * Math.PI * 2;
  const ex = Math.cos(theta) * 43;
  const ey = Math.sin(theta) * 20;
  const x = 43 + ex * Math.cos(phi) - ey * Math.sin(phi);
  const y = 35 + ex * Math.sin(phi) + ey * Math.cos(phi);
  return (
    <div style={{ position: 'absolute', left: 1100, top: 100, width: 110, height: 142, background: '#070b0c', border: `1px solid ${EDGE}`, borderRadius: 3, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 8, letterSpacing: '.1em', color: LABEL, alignSelf: 'flex-start' }}>ORBIT NAV</div>
      <div aria-hidden="true" style={{ position: 'relative', width: 88, height: 70, marginTop: 4 }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#cfd2d6,#6b7277 70%)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px rgba(200,210,212,.4)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 86, height: 40, border: '1px solid rgba(94,233,212,.55)', borderRadius: '50%', transform: 'translate(-50%,-50%) rotate(-12deg)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 60, height: 26, border: '1px solid rgba(94,233,212,.25)', borderRadius: '50%', transform: 'translate(-50%,-50%) rotate(-12deg)' }} />
        <div style={{ position: 'absolute', left: x - 3, top: y - 3, width: 6, height: 6, borderRadius: '50%', background: '#eab308', boxShadow: '0 0 5px #eab308', opacity: hidden ? 0.2 : 1, transition: 'left 200ms linear, top 200ms linear, opacity 400ms' }} />
      </div>
      <div style={{ fontSize: 8, letterSpacing: '.06em', color: LABEL2, marginTop: 2 }}>INCL 11.2&deg;</div>
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

export default function CanopyHud({
  hud,
  assist,
  log,
  onLeft,
  onRight,
  onReplay,
  onFaceMoon,
  onToggleAssist,
  onRestart,
}: {
  hud: DroneHud;
  assist: boolean;
  log: RadioLine[];
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onReplay: () => void;
  onFaceMoon: () => void;
  onToggleAssist: () => void;
  onRestart: () => void;
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

  const obj = objective(hud);
  const last = log[log.length - 1];
  const live = !!last && hud.t - last.at < 6 && !hud.linkLost;
  const sign = hud.tempC > 0 ? '+' : '';
  const vd = hud.velDelta;
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

  const lockLed: LedState = hud.stage === 'acquire' ? 'standby' : 'active';
  const commsLed: LedState = hud.linkLost ? 'fault' : 'active';

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,Consolas,monospace", color: '#cfeceb', lineHeight: 'normal' }}>
      <style>{CSS}</style>

      {/* ---- cinema layers (beneath the hardware) ---- */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 48%, rgba(0,0,0,.55) 92%)' }} />
      <div className="absolute inset-0 mix-blend-screen" style={{ opacity: hud.sunGlow * 0.85, transition: 'opacity 600ms ease', background: 'radial-gradient(circle at 62% 30%, rgba(255,232,190,0.95) 0%, rgba(255,190,110,0.35) 28%, rgba(255,160,80,0) 62%)' }} />
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
          <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#6fb8b0' }}>SPACE DRONE</div>
          <div style={{ fontSize: 16, letterSpacing: '.04em', color: TEXT, marginTop: 2 }}>Shuttle&#8209;class flight</div>
        </div>

        <RadioXmit live={live} lost={hud.linkLost} />

        <div style={{ position: 'absolute', right: 220, top: 20, display: 'flex', gap: 10 }} className="pointer-events-auto">
          <button type="button" className="cn-btn" onClick={onFaceMoon} style={{ padding: '9px 14px', borderRadius: 3, fontSize: 11, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Led color={TEAL} state={hud.facingDeg < 8 ? 'active' : 'off'} />FACE MOON
          </button>
          <button type="button" className="cn-btn" onClick={onToggleAssist} aria-pressed={assist} style={{ padding: '9px 14px', borderRadius: 3, fontSize: 11, display: 'flex', alignItems: 'center', gap: 7, ...(assist ? { borderColor: TEAL, color: TEXT } : {}) }}>
            <Led color={TEAL} state={assist ? 'active' : 'off'} />ORBIT ASSIST
          </button>
          <button type="button" className="cn-btn" onClick={onReplay} style={{ padding: '9px 14px', borderRadius: 3, fontSize: 11, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Led color="#5a656c" state="off" />REPLAY LAUNCH
          </button>
        </div>

        {/* the site's own links, kept in the crossbeam's open right end */}
        <div style={{ position: 'absolute', right: 40, top: 24, display: 'flex', alignItems: 'center', gap: 8 }} className="pointer-events-auto">
          <ModeBadge mode="SIM" note="Simulated vehicle and flight, Moon not to scale. The Moon surface is NASA imagery." />
          <Link href="/astro-sim" aria-label="Observatory" title="Observatory" className="cn-btn" style={{ width: 34, height: 34, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Orbit style={{ width: 16, height: 16 }} />
          </Link>
          <Link href="/" aria-label="Home" title="Home" className="cn-btn" style={{ width: 34, height: 34, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home style={{ width: 16, height: 16 }} />
          </Link>
        </div>

        {/* comms log */}
        <div style={{ position: 'absolute', left: 46, top: 150, width: 360, background: 'rgba(8,14,16,.72)', border: '1px solid rgba(94,233,212,.35)', borderRadius: 4, padding: '14px 16px', boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.12em', color: hud.linkLost ? '#fb7185' : TEAL, borderBottom: '1px solid rgba(94,233,212,.25)', paddingBottom: 8, marginBottom: 8 }}>
            <Led color={hud.linkLost ? '#fb7185' : '#34d399'} state={commsLed} size={7} />
            {hud.linkLost ? 'COMMS · NO SIGNAL · FAR SIDE' : 'COMMS · CH 1'}
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
          <div style={{ fontSize: 10, letterSpacing: '.14em', color: '#8fb6b2' }}>{obj.title}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: TEXT }}>{obj.status}</div>
          <div style={{ marginTop: 8, height: 4, background: '#1a2a29', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, Math.round(obj.fill * 100))}%`, height: '100%', background: TEAL, transition: 'width 600ms ease' }} />
          </div>
        </div>
      </div>

      {hud.stage === 'done' && (
        <div className="absolute inset-x-0 flex justify-center top-[36%]">
          <div className="pointer-events-auto" style={{ background: 'rgba(8,14,16,.88)', border: '1px solid rgba(94,233,212,.45)', borderRadius: 4, padding: '20px 34px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: '.3em', color: LABEL2 }}>MISSION 01</div>
            <div style={{ fontSize: 22, letterSpacing: '.2em', color: TEAL, marginTop: 4 }}>ORBIT COMPLETE</div>
            <div style={{ fontSize: 11, color: LABEL2, marginTop: 4 }}>The relay is aligned. The lights stay on.</div>
            <button type="button" className="cn-btn" onClick={onRestart} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 3, fontSize: 11, letterSpacing: '.14em' }}>FLY AGAIN</button>
          </div>
        </div>
      )}

      {/* ---- bottom stage: the console ---- */}
      <div style={stage(300, 'bottom')}>
        <Tape heading={hud.headingDeg} />
        <div style={{ position: 'absolute', left: 520, top: 88, width: 262, textAlign: 'center', fontSize: 9, letterSpacing: '.06em', color: LABEL, whiteSpace: 'nowrap' }}>
          W/S THROTTLE &middot; A/D YAW &middot; ARROWS PITCH/ROLL
        </div>

        {/* thrust meter */}
        <div style={{ position: 'absolute', left: 700, top: 100, width: 40, height: 150, background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }} aria-label={`Throttle ${Math.round(hud.throttle * 100)} percent`}>
          <div style={{ height: `${Math.round(hud.throttle * 100)}%`, background: 'linear-gradient(180deg,#5ee9d4,#1b7a6c)', transition: 'height 500ms ease' }} />
        </div>
        <div style={{ position: 'absolute', left: 688, top: 258, width: 64, textAlign: 'center', fontSize: 9, letterSpacing: '.08em', color: LABEL }}>THR {Math.round(hud.throttle * 100)}%</div>

        {/* grips */}
        <div style={{ position: 'absolute', left: 70, top: 82 }}>
          <FlightStick variant="grip" side="left" label="Yaw / Throttle" color={TEAL} onChange={onLeft} />
        </div>
        <div style={{ position: 'absolute', right: 70, top: 82 }}>
          <FlightStick variant="grip" side="right" label="Roll / Pitch" color={TEAL} onChange={onRight} />
        </div>

        {/* digital speedometer */}
        <div style={{ position: 'absolute', left: 250, top: 106, width: 220, height: 104, background: '#0a0f10', border: `1px solid ${EDGE}`, borderRadius: 3, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} aria-label={`Speed ${hud.velKms.toFixed(2)} kilometres per second`}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', color: LABEL }}>SPEED</div>
          <div style={{ fontSize: 34, lineHeight: 1, color: TEAL, textShadow: '0 0 10px rgba(94,233,212,.55)', letterSpacing: '.02em' }}>{hud.velKms.toFixed(2)}</div>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: LABEL2 }}>KM/S &middot; V&Delta; {vd >= 0 ? '+' : '−'}{Math.abs(vd).toFixed(2)}</div>
        </div>

        <OrbitNav lap={hud.orbit} hidden={hud.linkLost} />

        {/* telemetry grid */}
        <div style={{ position: 'absolute', left: 790, top: 93, width: 300, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }} aria-label="Flight data">
          <Tele label="ALTITUDE" value={Math.round(hud.altKm).toLocaleString()} unit="km" />
          <Tele label="VELOCITY" value={hud.velKms.toFixed(2)} unit="km/s" />
          <Tele label="RANGE · CENTRE" value={Math.round(hud.rangeKm).toLocaleString()} unit="km" />
          <Tele label="SURFACE TEMP" value={`${sign}${Math.round(hud.tempC)}`.replace('-', '−')} unit="°C" />
          <Tele label="AMBIENT PRESS" value={`${(hud.pressureBar * 1e15).toFixed(1)}E−15`} unit="bar" />
          <Tele label="G‑LOAD" value={hud.gLoad.toFixed(2)} unit="g" />
          <Tele label="RADIATION" value={hud.radUsv.toFixed(2)} unit="µSv/h" />
          <Tele label="RADIO LINK" value={hud.linkLost ? 'LOS' : `${Math.round(hud.linkDb)}`} unit={hud.linkLost ? undefined : 'dB'} warn={hud.linkLost} />
        </div>

        {/* indicator row */}
        <div aria-hidden="true" style={{ position: 'absolute', left: 260, top: 230, display: 'grid', gridTemplateColumns: 'repeat(4,56px)', gridTemplateRows: 'repeat(2,30px)', gap: 6 }}>
          <Toggle label="NAV" color="#34d399" state="active" />
          <Toggle label="COMMS" color={hud.linkLost ? '#fb7185' : '#34d399'} state={commsLed} />
          <Toggle label="CABIN" color="#34d399" state="active" />
          <Toggle label="LOCK" color="#eab308" state={lockLed} />
          <Toggle label="THERM" color="#5a656c" state="off" />
          <Toggle label="PWR" color="#34d399" state="active" />
          <Toggle label="GYRO" color="#34d399" state="active" />
          <Toggle label="AUX" color="#5a656c" state="off" />
        </div>
      </div>

      {/* scanlines */}
      <div aria-hidden="true" className="absolute inset-0" style={{ opacity: 0.05, backgroundImage: 'repeating-linear-gradient(180deg,#fff 0,#fff 1px,transparent 1px,transparent 3px)' }} />
    </div>
  );
}
