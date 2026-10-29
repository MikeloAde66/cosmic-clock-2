'use client';

import type { DroneHud } from './DroneScene';
import FlightStick from './FlightStick';
import type { RadioLine } from '@/lib/astroSim/droneMission';

// The pilot's view: a single instrument dash along the bottom of the screen in
// polished black and chrome, with cinema layers over the live 3D scene. The
// window itself is left completely open. All instruments ease between readings
// (CSS transitions) so needles glide, and a few things always move: slowly
// flashing switch lights, a turning gyro wheel, a drifting specular sweep and
// film grain.

const CHROME = 'linear-gradient(135deg,#f5f7fa 0%,#9aa3ad 18%,#3a4048 38%,#c9ced4 52%,#6c737b 70%,#e8ebee 86%,#555c64 100%)';

const CSS = `
@keyframes cp-blink { 0%,100% { opacity: .22 } 50% { opacity: 1 } }
@keyframes cp-spin { to { transform: rotate(360deg) } }
@keyframes cp-grain { 0% { transform: translate(0,0) } 20% { transform: translate(-3%,2%) } 40% { transform: translate(2%,-3%) } 60% { transform: translate(-2%,-1%) } 80% { transform: translate(3%,3%) } 100% { transform: translate(0,0) } }
@keyframes cp-glare { 0% { transform: translateX(-30%) } 100% { transform: translateX(130%) } }
@keyframes cp-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@keyframes cp-bar { 0%,100% { height: 2px } 50% { height: 10px } }
@keyframes cp-breathe { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
.cp-blink { animation: cp-blink var(--d, 4s) ease-in-out var(--o, 0s) infinite }
.cp-spin { animation: cp-spin 60s linear infinite; transform-origin: 50% 50% }
.cp-grain { animation: cp-grain .9s steps(5) infinite }
.cp-glare { animation: cp-glare 22s linear infinite }
.cp-sweep { animation: cp-glare 38s linear infinite }
.cp-in { animation: cp-in .6s ease-out }
.cp-bar { animation: cp-bar .5s ease-in-out var(--o, 0s) infinite }
.cp-breathe { animation: cp-breathe 5s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cp-blink, .cp-spin, .cp-grain, .cp-glare, .cp-sweep, .cp-breathe, .cp-in, .cp-bar { animation: none !important } }
`;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const SWITCHES: [string, string, string][] = [
  // label, flash duration, flash offset (seconds); a duration of 0 means steady
  ['NAV', '4.2s', '0s'],
  ['COMMS', '6.1s', '1.3s'],
  ['CABIN', '0', '0s'],
  ['LOCK', '3.4s', '2.2s'],
  ['THERM', '7.3s', '0.6s'],
  ['PWR', '0', '0s'],
  ['GYRO', '5.2s', '3.1s'],
  ['AUX', '8.4s', '1.9s'],
];

function ChromeDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-ch`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f5f7fa" />
        <stop offset="0.2" stopColor="#9aa3ad" />
        <stop offset="0.4" stopColor="#3a4048" />
        <stop offset="0.55" stopColor="#c9ced4" />
        <stop offset="0.75" stopColor="#6c737b" />
        <stop offset="1" stopColor="#e8ebee" />
      </linearGradient>
      <radialGradient id={`${id}-face`} cx="0.4" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#1a1f26" />
        <stop offset="0.7" stopColor="#07090c" />
        <stop offset="1" stopColor="#020304" />
      </radialGradient>
    </defs>
  );
}

// A glass highlight, drawn over a round gauge face.
function Glass() {
  return <path d="M18 40 A46 46 0 0 1 70 14 Q40 24 22 56 Z" fill="#ffffff" opacity="0.1" />;
}

function Gear({ teeth = 12, r = 22 }: { teeth?: number; r?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    pts.push(`${(30 + Math.cos(a) * rr).toFixed(1)},${(30 + Math.sin(a) * rr).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 60 60" className="w-12 h-12 cp-spin" aria-hidden="true">
      <ChromeDefs id="cp-gear" />
      <polygon points={pts.join(' ')} fill="url(#cp-gear-ch)" stroke="#1b1f25" strokeWidth="0.8" />
      <circle cx="30" cy="30" r="12" fill="url(#cp-gear-face)" stroke="#9aa3ad" strokeWidth="0.8" />
      <circle cx="30" cy="30" r="3" fill="url(#cp-gear-ch)" />
      <circle cx="30" cy="30" r="1.2" fill="#22d3ee" />
    </svg>
  );
}

function Attitude({ pitch, roll }: { pitch: number; roll: number }) {
  const ladder = [-30, -20, -10, 10, 20, 30];
  return (
    <div className="relative w-[118px] h-[118px] sm:w-[132px] sm:h-[132px]">
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-label={`Pitch ${Math.round(pitch)} roll ${Math.round(roll)}`}>
        <ChromeDefs id="cp-att" />
        <defs>
          <clipPath id="cp-att-clip"><circle cx="60" cy="60" r="52" /></clipPath>
        </defs>
        <circle cx="60" cy="60" r="58" fill="url(#cp-att-ch)" />
        <g clipPath="url(#cp-att-clip)">
          <g style={{ transform: `rotate(${-roll}deg) translateY(${pitch * 1.5}px)`, transformOrigin: '60px 60px', transition: 'transform 600ms cubic-bezier(.25,.8,.3,1)' }}>
            <rect x="-80" y="-120" width="280" height="180" fill="#1d4e89" />
            <rect x="-80" y="60" width="280" height="180" fill="#5a3b20" />
            <line x1="-80" y1="60" x2="200" y2="60" stroke="#e2e8f0" strokeWidth="1.2" />
            {ladder.map((p) => (
              <line key={p} x1={60 - (Math.abs(p) === 10 ? 9 : 14)} y1={60 - p * 1.5} x2={60 + (Math.abs(p) === 10 ? 9 : 14)} y2={60 - p * 1.5} stroke="#cbd5e1" strokeWidth="0.8" />
            ))}
          </g>
        </g>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#000" strokeWidth="1.5" />
        <path d="M30 60 H50 M70 60 H90 M60 56 V64" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <polygon points="60,10 56,18 64,18" fill="#fbbf24" />
        <Glass />
      </svg>
    </div>
  );
}

function HeadingTape({ heading }: { heading: number }) {
  const labels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  const span = 120; // degrees visible
  const items: { deg: number; x: number }[] = [];
  for (let d = -span; d <= span; d += 10) {
    const abs = (Math.round(heading / 10) * 10 + d + 360) % 360;
    const off = (abs - heading + 540) % 360 - 180;
    items.push({ deg: abs, x: 50 + (off / span) * 50 });
  }
  return (
    <div className="p-[3px] rounded" style={{ background: CHROME }}>
      <div className="relative h-9 overflow-hidden rounded-sm w-[224px]" style={{ background: 'linear-gradient(180deg,#14181e,#050607)' }} aria-label={`Heading ${Math.round(heading)}`}>
        {items.map((it, i) => (
          <div key={i} className="absolute top-0 text-[9px] text-slate-300 -translate-x-1/2" style={{ left: `${it.x}%`, transition: 'left 500ms linear' }}>
            <div className={`mx-auto w-px ${it.deg % 30 === 0 ? 'h-3 bg-slate-200' : 'h-2 bg-slate-600'}`} />
            {it.deg % 30 === 0 && <div className={labels[it.deg] ? 'text-cyan-300' : ''}>{labels[it.deg] ?? it.deg}</div>}
          </div>
        ))}
        <div className="absolute inset-y-0 w-px bg-amber-400 left-1/2" />
      </div>
    </div>
  );
}

// A small chrome-edged plate used for readouts and buttons.
function Plate({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-[2px] rounded ${className}`} style={{ background: CHROME }}>
      <div className="rounded-[3px] px-3 py-1" style={{ background: 'linear-gradient(180deg,#171b21,#050608)' }}>{children}</div>
    </div>
  );
}

function ChromeButton({ onClick, children, on }: { onClick: () => void; children: React.ReactNode; on?: boolean }) {
  return (
    <button onClick={onClick} className="p-[2px] rounded pointer-events-auto" style={{ background: CHROME }}>
      <span
        className={`flex items-center h-7 gap-2 px-3 text-[10px] uppercase tracking-[0.12em] rounded-[3px] ${on === undefined ? 'text-slate-200' : on ? 'text-cyan-200' : 'text-slate-400'}`}
        style={{ background: 'linear-gradient(180deg,#1a1f26,#050608)' }}
      >
        {on !== undefined && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? '#22d3ee' : '#475569', boxShadow: on ? '0 0 6px #22d3ee' : 'none' }} />}
        {children}
      </span>
    </button>
  );
}

// A digital readout cell: chrome bezel around a dark LCD with glowing digits.
function Cell({ label, value, unit, sub, warn, className = '' }: { label: string; value: string; unit?: string; sub?: string; warn?: boolean; className?: string }) {
  return (
    <div className={`p-[2px] rounded-sm ${className}`} style={{ background: CHROME }}>
      <div className="px-2 py-1 rounded-[2px]" style={{ background: 'linear-gradient(180deg,#05100f,#020605)', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.9)' }}>
        <div className="text-[7px] tracking-[0.18em] text-slate-500 whitespace-nowrap">{label}</div>
        <div className="font-mono text-[14px] sm:text-[15px] leading-tight tabular-nums whitespace-nowrap" style={{ color: warn ? '#fb7185' : '#7ff5ff', textShadow: '0 0 6px currentColor' }}>
          {value}
          {unit && <span className="ml-1 text-[8px] text-slate-400" style={{ textShadow: 'none' }}>{unit}</span>}
        </div>
        <div className="h-[9px] text-[7px] leading-[9px] text-slate-500 whitespace-nowrap">{sub ?? ''}</div>
      </div>
    </div>
  );
}

export const WHO: Record<RadioLine['who'], { tag: string; color: string }> = {
  CAPCOM: { tag: 'MISSION CTRL', color: '#67e8f9' },
  SURFACE: { tag: 'SHACKLETON', color: '#fbbf24' },
  'NAV-AI': { tag: 'NAV-AI', color: '#c4b5fd' },
  STATION: { tag: 'HALCYON', color: '#86efac' },
  EDL: { tag: 'EDL TEAM', color: '#fdba74' },
  SCIENCE: { tag: 'SCIENCE TEAM', color: '#f0abfc' },
};

export function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Radio({ log, t, linkLost }: { log: RadioLine[]; t: number; linkLost: boolean }) {
  const last = log[log.length - 1];
  const live = !!last && t - last.at < 6;
  return (
    <div className="absolute left-3 top-[104px] sm:top-3 w-[calc(100vw-150px)] sm:w-[330px]">
      <div className="p-[2px] rounded" style={{ background: CHROME }}>
        <div className="rounded-[3px] px-2.5 py-1.5" style={{ background: 'linear-gradient(180deg,rgba(23,27,33,0.94),rgba(5,6,8,0.94))' }}>
          <div className="flex items-center gap-2 text-[8px] tracking-[0.2em] text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'cp-blink' : ''}`} style={{ ['--d' as string]: '0.7s', background: linkLost ? '#fb7185' : '#34d399', boxShadow: '0 0 6px currentColor' } as React.CSSProperties} />
            {linkLost ? <span className="text-rose-300">COMMS · NO SIGNAL · FAR SIDE</span> : <span>COMMS · CH 1</span>}
            <span className="flex items-end gap-[2px] h-2.5 ml-auto" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => (
                <span key={n} className={`w-[2px] bg-cyan-300/80 ${live && !linkLost ? 'cp-bar' : ''}`} style={{ height: live && !linkLost ? undefined : 2, ['--o' as string]: `${n * 0.13}s` } as React.CSSProperties} />
              ))}
            </span>
          </div>
          <div className="mt-1 space-y-1.5 min-h-[34px]">
            {log.slice(-3).map((l, idx, arr) => {
              const age = arr.length - 1 - idx;
              return (
                <p key={l.id} className={`cp-in text-[10.5px] leading-snug text-slate-200 line-clamp-3 sm:line-clamp-none ${age >= 1 ? 'hidden sm:block' : ''}`} style={{ opacity: age === 0 ? 1 : age === 1 ? 0.62 : 0.4 }}>
                  <span className="mr-1.5 text-[8px] tracking-[0.14em]" style={{ color: WHO[l.who].color }}>{WHO[l.who].tag}</span>
                  <span className="mr-1.5 text-[8px] text-slate-500 tabular-nums">{clock(l.at)}</span>
                  {l.text}
                </p>
              );
            })}
            {log.length === 0 && <p className="text-[10px] text-slate-500">Standing by…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function objective(hud: DroneHud): { title: string; status: string; fill: number } {
  const lapPct = Math.round(hud.orbit * 100);
  switch (hud.stage) {
    case 'acquire':
      return { title: 'OBJECTIVE 1 · POINT THE NOSE AT THE MOON', status: `Lock ${Math.round(hud.lock * 100)}% · Moon ${Math.round(hud.facingDeg)}° off the nose`, fill: hud.lock };
    case 'burn':
      return { title: 'OBJECTIVE 2 · INSERTION BURN · THROTTLE ABOVE 60%', status: `Altitude ${Math.round(hud.altKm).toLocaleString()} km → 110 km`, fill: Math.max(0, Math.min(1, 1 - (hud.altKm - 110) / (1900 - 110))) };
    case 'orbit':
      return {
        title: 'OBJECTIVE 3 · FLY ONE FULL LAP',
        status: hud.linkLost ? `Lap ${lapPct}% · behind the Moon · radio silent` : `Lap ${lapPct}% · keep the Moon in the window`,
        fill: hud.orbit,
      };
    default:
      return { title: 'MISSION 01 COMPLETE', status: 'ORBIT COMPLETE', fill: 1 };
  }
}

export default function CockpitHud({
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
  const obj = objective(hud);
  const sign = hud.tempC > 0 ? '+' : '';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <style>{CSS}</style>

      {/* ---- cinema layers ---- */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }}
      />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{ opacity: hud.sunGlow * 0.85, transition: 'opacity 600ms ease', background: 'radial-gradient(circle at 62% 30%, rgba(255,232,190,0.95) 0%, rgba(255,190,110,0.35) 28%, rgba(255,160,80,0) 62%)' }}
      />
      <div className="absolute inset-[-10%] cp-grain mix-blend-overlay opacity-[0.07]" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
        <div className="absolute inset-y-0 w-1/3 cp-glare" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.9), transparent)' }} />
      </div>

      {/* ---- objective plate ---- */}
      <div className="absolute inset-x-0 flex justify-center top-3">
        <Plate>
          <div className="min-w-[230px] sm:min-w-[340px] text-center">
            <p className="text-[8.5px] sm:text-[9px] tracking-[0.18em] text-slate-400">{obj.title}</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-cyan-200">{obj.status}</p>
            <div className="h-1.5 mt-1.5 overflow-hidden rounded-full bg-black/80 border border-slate-700">
              <div className="h-full" style={{ width: `${Math.round(obj.fill * 100)}%`, background: 'linear-gradient(90deg,#0891b2,#67e8f9)', transition: 'width 600ms ease' }} />
            </div>
          </div>
        </Plate>
      </div>

      <Radio log={log} t={hud.t} linkLost={hud.linkLost} />

      <div className="absolute flex flex-col items-end gap-2 top-[104px] sm:top-3 right-3">
        <ChromeButton onClick={onFaceMoon}>Face Moon</ChromeButton>
        <ChromeButton onClick={onToggleAssist} on={assist}>Orbit assist</ChromeButton>
        <ChromeButton onClick={onReplay}>Replay launch</ChromeButton>
      </div>

      {hud.stage === 'done' && (
        <div className="absolute inset-x-0 flex justify-center top-[34%]">
          <div className="p-[2px] rounded pointer-events-auto" style={{ background: CHROME }}>
            <div className="px-8 py-5 text-center rounded-[3px]" style={{ background: 'linear-gradient(180deg,#171b21,#050608)' }}>
              <p className="text-[10px] tracking-[0.3em] text-slate-400">MISSION 01</p>
              <p className="mt-1 text-xl tracking-[0.2em] text-cyan-200">ORBIT COMPLETE</p>
              <p className="mt-1 text-[11px] text-slate-400">The relay is aligned. The lights stay on.</p>
              <button onClick={onRestart} className="mt-3 h-8 px-4 text-[11px] uppercase tracking-[0.14em] border rounded border-cyan-500/60 text-cyan-100 hover:text-white">
                Fly again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- instrument dash: chrome rim over polished black ---- */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none h-[clamp(205px,36vh,310px)]"
        style={{
          background: CHROME,
          clipPath: 'polygon(0 14%, 10% 7%, 24% 2.5%, 50% 0, 76% 2.5%, 90% 7%, 100% 14%, 100% 100%, 0 100%)',
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 top-[5px] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1c2128 0%, #0a0d11 22%, #050608 60%, #0b0e12 100%)',
            clipPath: 'polygon(0 14%, 10% 7%, 24% 2.5%, 50% 0, 76% 2.5%, 90% 7%, 100% 14%, 100% 100%, 0 100%)',
          }}
        >
          {/* mirror-like reflections in spots */}
          <div className="absolute inset-x-0 top-0 h-[22%]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0))' }} />
          <div className="absolute -inset-x-10 top-[18%] h-[10%] -skew-y-3 opacity-[0.07]" style={{ background: 'linear-gradient(90deg, transparent, #fff 30%, transparent 60%, #fff 85%, transparent)' }} />
          <div className="absolute inset-y-0 w-1/4 opacity-[0.11] cp-sweep" style={{ background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.95) 45%, rgba(190,225,255,0.5) 55%, transparent)' }} />
          <div className="absolute inset-x-0 h-px top-[3%] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent cp-breathe" />

          <div className="absolute inset-0 flex items-end justify-between gap-2 px-3 pb-3 pt-[9%] sm:px-8">
            {/* left: stick + switch bank */}
            <div className="flex items-end gap-3">
              <FlightStick label="Yaw / Throttle" color="#22d3ee" onChange={onLeft} />
              <div className="hidden lg:grid grid-cols-4 gap-1.5 p-2 rounded-sm" style={{ background: 'linear-gradient(180deg,#0e1115,#040506)', boxShadow: 'inset 0 0 0 1px #3a4048' }} aria-hidden="true">
                {SWITCHES.map(([label, d, o]) => (
                  <div key={label} className="flex flex-col items-center justify-center w-11 h-9 rounded-sm" style={{ background: CHROME, padding: 1.5 }}>
                    <div className="flex flex-col items-center justify-center w-full h-full rounded-[2px]" style={{ background: 'linear-gradient(180deg,#232830,#080a0d)' }}>
                      <span
                        className={`w-2 h-2 rounded-full ${d === '0' ? '' : 'cp-blink'}`}
                        style={{ background: label === 'LOCK' || label === 'AUX' ? '#f59e0b' : '#34d399', boxShadow: '0 0 6px currentColor', ['--d' as string]: d, ['--o' as string]: o } as React.CSSProperties}
                      />
                      <span className="mt-0.5 text-[7px] tracking-wider text-slate-400">{label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* centre: digital instruments */}
            <div className="flex flex-col items-center gap-2">
              <div className="hidden sm:block"><HeadingTape heading={hud.headingDeg} /></div>
              <div className="flex items-end gap-2 sm:gap-3">
                <div className="hidden sm:block"><Attitude pitch={hud.pitchDeg} roll={hud.rollDeg} /></div>
                <div className="flex-col items-center hidden gap-1 sm:flex">
                  <div className="p-[2px] rounded" style={{ background: CHROME }}>
                    <div className="flex flex-col-reverse gap-[2px] p-1 rounded-[2px] bg-black" aria-label={`Throttle ${Math.round(hud.throttle * 100)} percent`}>
                      {Array.from({ length: 10 }, (_, i) => {
                        const on = hud.throttle * 10 > i;
                        return <div key={i} className="w-7 h-[5px] rounded-[1px]" style={{ background: on ? (i > 7 ? '#f59e0b' : '#34d399') : '#14202b', boxShadow: on ? '0 0 5px rgba(52,211,153,0.6)' : 'none', transition: 'background 400ms' }} />;
                      })}
                    </div>
                  </div>
                  <span className="text-[8px] tracking-widest text-slate-500">THR {Math.round(hud.throttle * 100)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1 w-[164px] sm:w-[218px]" aria-label="Flight data">
                  <Cell label="ALTITUDE" value={Math.round(hud.altKm).toLocaleString()} unit="km" sub={hud.stage === 'acquire' ? 'APPROACH' : hud.stage === 'burn' ? 'DESCENDING' : 'ORBITAL'} />
                  <Cell label="VELOCITY" value={hud.velKms.toFixed(2)} unit="km/s" sub={`THR ${Math.round(hud.throttle * 100)}%`} />
                  <Cell className="hidden sm:block" label="RANGE · CENTRE" value={Math.round(hud.rangeKm).toLocaleString()} unit="km" sub="TO MOON" />
                  <Cell label="SURFACE TEMP" value={`${sign}${Math.round(hud.tempC)}`} unit="°C" sub={hud.tempC > 20 ? 'DAY SIDE' : hud.tempC < -60 ? 'NIGHT SIDE' : 'TERMINATOR'} />
                  <Cell className="hidden sm:block" label="AMBIENT PRESS" value={`${(hud.pressureBar * 1e15).toFixed(1)}E-15`} unit="bar" sub="VACUUM · EXOSPHERE" />
                  <Cell className="hidden sm:block" label="G-LOAD" value={hud.gLoad.toFixed(2)} unit="g" sub={`MOON FIELD ${hud.localG.toFixed(2)} m/s²`} />
                  <Cell className="hidden sm:block" label="RADIATION" value={hud.radUsv.toFixed(2)} unit="µSv/h" sub={hud.sunGlow > 0.3 ? 'SOLAR GLARE' : 'BACKGROUND'} />
                  <Cell label="RADIO LINK" value={hud.linkLost ? 'LOS' : `${Math.round(hud.linkDb)}`} unit={hud.linkLost ? undefined : 'dB'} sub={hud.linkLost ? 'FAR SIDE' : 'S-BAND'} warn={hud.linkLost} />
                </div>
              </div>
            </div>

            {/* right: gyro wheel + stick */}
            <div className="flex items-end gap-3">
              <div className="flex-col items-center hidden gap-1 lg:flex" aria-hidden="true">
                <Gear />
                <span className="text-[7px] tracking-widest text-slate-500">REACTION WHEEL</span>
                <span className="text-[8px] tracking-wider text-emerald-300 cp-blink" style={{ ['--d' as string]: '5s' } as React.CSSProperties}>SYS NOMINAL</span>
              </div>
              <FlightStick label="Roll / Pitch" color="#fbbf24" onChange={onRight} />
            </div>
          </div>
        </div>
      </div>

      <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 whitespace-nowrap">
        W/S throttle · A/D yaw · arrows pitch and roll · gamepad works · simulated, not to scale
      </p>
    </div>
  );
}
