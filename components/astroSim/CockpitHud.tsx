'use client';

import type { DroneHud } from './DroneScene';
import FlightStick from './FlightStick';

// The pilot's view: window frame, instrument panel and cinema layers drawn over
// the live 3D scene. All instruments ease between readings (CSS transitions) so
// needles glide instead of ticking, and a few things always move: flashing
// switch lights, a turning gyro wheel, drifting window glare and film grain.

const CSS = `
@keyframes cp-blink { 0%,100% { opacity: .22 } 50% { opacity: 1 } }
@keyframes cp-spin { to { transform: rotate(360deg) } }
@keyframes cp-grain { 0% { transform: translate(0,0) } 20% { transform: translate(-3%,2%) } 40% { transform: translate(2%,-3%) } 60% { transform: translate(-2%,-1%) } 80% { transform: translate(3%,3%) } 100% { transform: translate(0,0) } }
@keyframes cp-glare { 0% { transform: translateX(-30%) } 100% { transform: translateX(130%) } }
@keyframes cp-breathe { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
.cp-blink { animation: cp-blink var(--d, 4s) ease-in-out var(--o, 0s) infinite }
.cp-spin { animation: cp-spin 26s linear infinite; transform-origin: 50% 50% }
.cp-grain { animation: cp-grain .9s steps(5) infinite }
.cp-glare { animation: cp-glare 22s linear infinite }
.cp-breathe { animation: cp-breathe 5s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cp-blink, .cp-spin, .cp-grain, .cp-glare, .cp-breathe { animation: none !important } }
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

function Gear({ teeth = 12, r = 22 }: { teeth?: number; r?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    pts.push(`${(30 + Math.cos(a) * rr).toFixed(1)},${(30 + Math.sin(a) * rr).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 60 60" className="w-12 h-12 cp-spin" aria-hidden="true">
      <polygon points={pts.join(' ')} fill="#1b2430" stroke="#5b6b7f" strokeWidth="1" />
      <circle cx="30" cy="30" r="7" fill="#0b0f15" stroke="#5b6b7f" />
      <circle cx="30" cy="30" r="2" fill="#22d3ee" />
    </svg>
  );
}

function SpeedDial({ speed, max }: { speed: number; max: number }) {
  const sweep = 270;
  const ang = -135 + (Math.min(speed, max) / max) * sweep;
  const ticks = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div className="relative w-[118px] h-[118px] sm:w-[132px] sm:h-[132px]">
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-label={`Speed ${Math.round(speed)} units per second`}>
        <circle cx="60" cy="60" r="57" fill="#05080d" stroke="#4a5a6e" strokeWidth="2" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="#111a26" strokeWidth="1" />
        {ticks.map((i) => {
          const a = ((-135 + (i / 21) * sweep) * Math.PI) / 180;
          const major = i % 3 === 0;
          const r1 = 50, r2 = major ? 42 : 46;
          return <line key={i} x1={60 + Math.sin(a) * r1} y1={60 - Math.cos(a) * r1} x2={60 + Math.sin(a) * r2} y2={60 - Math.cos(a) * r2} stroke={major ? '#cbd5e1' : '#64748b'} strokeWidth={major ? 1.6 : 1} />;
        })}
        {[0, 100, 200, 300, 400].map((v) => {
          const a = ((-135 + (v / max) * sweep) * Math.PI) / 180;
          return (
            <text key={v} x={60 + Math.sin(a) * 33} y={60 - Math.cos(a) * 33 + 3} fontSize="8" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
              {v}
            </text>
          );
        })}
        <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: '60px 60px', transition: 'transform 220ms linear' }}>
          <polygon points="60,16 62.2,60 57.8,60" fill="#f97316" />
          <circle cx="60" cy="60" r="4.5" fill="#111827" stroke="#f97316" />
        </g>
        <text x="60" y="88" fontSize="7" fill="#64748b" textAnchor="middle" fontFamily="monospace">SPEED u/s</text>
        <text x="60" y="100" fontSize="10" fill="#67e8f9" textAnchor="middle" fontFamily="monospace">{Math.round(speed)}</text>
      </svg>
    </div>
  );
}

function Attitude({ pitch, roll }: { pitch: number; roll: number }) {
  const ladder = [-30, -20, -10, 10, 20, 30];
  return (
    <div className="relative w-[118px] h-[118px] sm:w-[132px] sm:h-[132px]">
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-label={`Pitch ${Math.round(pitch)} roll ${Math.round(roll)}`}>
        <defs>
          <clipPath id="cp-att"><circle cx="60" cy="60" r="52" /></clipPath>
        </defs>
        <g clipPath="url(#cp-att)">
          <g style={{ transform: `rotate(${-roll}deg) translateY(${pitch * 1.5}px)`, transformOrigin: '60px 60px', transition: 'transform 220ms linear' }}>
            <rect x="-80" y="-120" width="280" height="180" fill="#1d4e89" />
            <rect x="-80" y="60" width="280" height="180" fill="#5a3b20" />
            <line x1="-80" y1="60" x2="200" y2="60" stroke="#e2e8f0" strokeWidth="1.2" />
            {ladder.map((p) => (
              <g key={p}>
                <line x1={60 - (Math.abs(p) === 10 ? 9 : 14)} y1={60 - p * 1.5} x2={60 + (Math.abs(p) === 10 ? 9 : 14)} y2={60 - p * 1.5} stroke="#cbd5e1" strokeWidth="0.8" />
              </g>
            ))}
          </g>
        </g>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#4a5a6e" strokeWidth="3" />
        <path d="M30 60 H50 M70 60 H90 M60 56 V64" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <polygon points="60,10 56,18 64,18" fill="#fbbf24" />
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
    <div className="relative h-9 overflow-hidden border rounded bg-black/60 border-slate-600 w-[230px]" aria-label={`Heading ${Math.round(heading)}`}>
      {items.map((it, i) => (
        <div key={i} className="absolute top-0 text-[9px] text-slate-300 -translate-x-1/2" style={{ left: `${it.x}%`, transition: 'left 200ms linear' }}>
          <div className={`mx-auto w-px ${it.deg % 30 === 0 ? 'h-3 bg-slate-300' : 'h-2 bg-slate-600'}`} />
          {it.deg % 30 === 0 && <div className={labels[it.deg] ? 'text-cyan-300' : ''}>{labels[it.deg] ?? it.deg}</div>}
        </div>
      ))}
      <div className="absolute inset-y-0 w-px bg-amber-400 left-1/2" />
    </div>
  );
}

export default function CockpitHud({
  hud,
  onLeft,
  onRight,
  onReplay,
  onFaceMoon,
}: {
  hud: DroneHud;
  onLeft: (x: number, y: number) => void;
  onRight: (x: number, y: number) => void;
  onReplay: () => void;
  onFaceMoon: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <style>{CSS}</style>

      {/* ---- cinema layers ---- */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62) 100%)' }}
      />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{ opacity: hud.sunGlow * 0.85, transition: 'opacity 400ms ease', background: 'radial-gradient(circle at 62% 30%, rgba(255,232,190,0.95) 0%, rgba(255,190,110,0.35) 28%, rgba(255,160,80,0) 62%)' }}
      />
      <div className="absolute inset-[-10%] cp-grain mix-blend-overlay opacity-[0.07]" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 overflow-hidden opacity-[0.07]">
        <div className="absolute inset-y-0 w-1/3 cp-glare" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.9), transparent)' }} />
      </div>

      {/* ---- window frame ---- */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cp-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#05070a" /><stop offset="0.7" stopColor="#141b24" /><stop offset="1" stopColor="#202a36" />
          </linearGradient>
          <linearGradient id="cp-metal-r" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#05070a" /><stop offset="0.7" stopColor="#141b24" /><stop offset="1" stopColor="#202a36" />
          </linearGradient>
        </defs>
        <polygon points="0,0 78,0 38,600 0,600" fill="url(#cp-metal)" />
        <polygon points="1000,0 922,0 962,600 1000,600" fill="url(#cp-metal-r)" />
        <polygon points="0,0 1000,0 1000,34 700,24 300,24 0,34" fill="#0a0f15" />
        <line x1="78" y1="0" x2="38" y2="600" stroke="#3a4757" strokeWidth="2" />
        <line x1="922" y1="0" x2="962" y2="600" stroke="#3a4757" strokeWidth="2" />
        <line x1="0" y1="34" x2="300" y2="24" stroke="#3a4757" strokeWidth="1.5" />
        <line x1="1000" y1="34" x2="700" y2="24" stroke="#3a4757" strokeWidth="1.5" />
      </svg>

      {/* ---- instrument panel ---- */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none h-[clamp(215px,38vh,330px)]"
        style={{
          background: 'linear-gradient(180deg, #0c121a 0%, #070b10 40%, #04060a 100%)',
          clipPath: 'polygon(0 12%, 9% 6%, 22% 2%, 50% 0, 78% 2%, 91% 6%, 100% 12%, 100% 100%, 0 100%)',
          boxShadow: 'inset 0 6px 24px rgba(103,232,249,0.08)',
        }}
      >
        <div className="absolute inset-x-0 top-[3%] h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent cp-breathe" />
        <div className="absolute inset-0 flex items-end justify-between gap-2 px-3 pb-3 pt-[9%] sm:px-8">
          {/* left: stick + switch bank */}
          <div className="flex items-end gap-3">
            <FlightStick label="Yaw / Throttle" color="#22d3ee" onChange={onLeft} />
            <div className="hidden md:grid grid-cols-4 gap-1.5 p-2 border rounded bg-black/50 border-slate-700" aria-hidden="true">
              {SWITCHES.map(([label, d, o]) => (
                <div key={label} className="flex flex-col items-center justify-center w-11 h-9 border rounded-sm border-slate-600 bg-gradient-to-b from-slate-800 to-slate-950">
                  <span
                    className={`w-2 h-2 rounded-full ${d === '0' ? '' : 'cp-blink'}`}
                    style={{ background: label === 'LOCK' || label === 'AUX' ? '#f59e0b' : '#34d399', boxShadow: '0 0 6px currentColor', ['--d' as string]: d, ['--o' as string]: o } as React.CSSProperties}
                  />
                  <span className="mt-0.5 text-[7px] tracking-wider text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* centre: instruments */}
          <div className="flex flex-col items-center gap-2">
            <div className="hidden sm:block"><HeadingTape heading={hud.headingDeg} /></div>
            <div className="flex items-end gap-2 sm:gap-4">
              <Attitude pitch={hud.pitchDeg} roll={hud.rollDeg} />
              <div className="flex flex-col items-center gap-1">
                {/* throttle stack */}
                <div className="flex flex-col-reverse gap-[2px] p-1 border rounded bg-black/60 border-slate-700" aria-label={`Throttle ${Math.round(hud.throttle * 100)} percent`}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const on = hud.throttle * 10 > i;
                    return <div key={i} className="w-7 h-[5px] rounded-[1px]" style={{ background: on ? (i > 7 ? '#f59e0b' : '#34d399') : '#14202b', boxShadow: on ? '0 0 5px rgba(52,211,153,0.6)' : 'none', transition: 'background 200ms' }} />;
                  })}
                </div>
                <span className="text-[8px] tracking-widest text-slate-500">THR {Math.round(hud.throttle * 100)}%</span>
              </div>
              <SpeedDial speed={hud.speed} max={420} />
            </div>
            <div className="hidden px-3 py-1 text-[10px] tabular-nums border rounded sm:block bg-black/60 border-slate-700 text-cyan-200">
              MOON {Math.round(hud.moonDist).toLocaleString()} u
              <span className="mx-2 text-slate-600">|</span>
              PITCH {Math.round(hud.pitchDeg)}°
              <span className="mx-2 text-slate-600">|</span>
              ROLL {Math.round(hud.rollDeg)}°
            </div>
          </div>

          {/* right: gyro wheel + stick */}
          <div className="flex items-end gap-3">
            <div className="flex-col items-center hidden gap-1 md:flex" aria-hidden="true">
              <Gear />
              <span className="text-[7px] tracking-widest text-slate-500">REACTION WHEEL</span>
              <span className="text-[8px] tracking-wider text-emerald-300 cp-blink" style={{ ['--d' as string]: '5s' } as React.CSSProperties}>SYS NOMINAL</span>
            </div>
            <FlightStick label="Roll / Pitch" color="#fbbf24" onChange={onRight} />
          </div>
        </div>
      </div>

      <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 whitespace-nowrap">
        W/S throttle · A/D yaw · arrows pitch and roll · gamepad works · simulated, not to scale
      </p>

      <div className="absolute flex flex-col gap-2 top-10 right-3 pointer-events-auto">
        <button
          onClick={onFaceMoon}
          className="flex items-center h-8 gap-1.5 px-3 text-[11px] uppercase tracking-wide border rounded bg-slate-900/70 border-cyan-500/50 text-cyan-100 hover:text-white"
        >
          Face Moon
        </button>
        <button
          onClick={onReplay}
          className="flex items-center h-8 gap-1.5 px-3 text-[11px] uppercase tracking-wide border rounded bg-slate-900/70 border-neutral-600 text-white/80 hover:text-white"
        >
          Replay launch
        </button>
      </div>
    </div>
  );
}
