'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import ModeBadge from '@/components/ModeBadge';
import { bodyHorizon, localSiderealHours } from '@/lib/astro/coords';
import { SDO_FILTERS, sdoUrl } from '@/lib/sdo';

const REFRESH_MS = 5 * 60 * 1000;
// Same default observer the rest of the Ai One apps use (Charleston, SC).
const DEFAULT_OBSERVER = { latDeg: 32.78, lonDeg: -79.93, label: 'Charleston, SC (default)' };

type Load = 'loading' | 'live' | 'failed';

// Clearly-labelled stand-in shown only if the SDO image cannot be fetched.
function SimSun({ tint }: { tint: [number, number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const N = c.width;
    const grad = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N * 0.42);
    const [r, gr, b] = tint;
    grad.addColorStop(0, `rgb(${r},${gr},${b})`);
    grad.addColorStop(0.85, `rgb(${r * 0.7},${gr * 0.6},${b * 0.5})`);
    grad.addColorStop(1, `rgb(${r * 0.3},${gr * 0.2},${b * 0.15})`);
    g.fillStyle = '#000';
    g.fillRect(0, 0, N, N);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(N / 2, N / 2, N * 0.42, 0, 7);
    g.fill();
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1800; i++) {
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * N * 0.41;
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`;
      g.beginPath();
      g.arc(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, 2 + rnd() * 8, 0, 7);
      g.fill();
    }
  }, [tint]);
  return <canvas ref={ref} width={600} height={600} className="w-full h-full" />;
}

export default function SunView() {
  const [code, setCode] = useState(SDO_FILTERS[0].code);
  const [bust, setBust] = useState(0);
  const [load, setLoad] = useState<Load>('loading');
  const [now, setNow] = useState<Date | null>(null);
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const filter = SDO_FILTERS.find((f) => f.code === code)!;

  useEffect(() => {
    const refresh = setInterval(() => setBust(Date.now()), REFRESH_MS);
    const tick = setInterval(() => setNow(new Date()), 1000);
    // First cache-bust after mount (Date.now() is impure during render).
    const first = setTimeout(() => {
      setBust(Date.now());
      setNow(new Date());
    }, 0);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      clearTimeout(first);
    };
  }, []);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setObserver({ latDeg: p.coords.latitude, lonDeg: p.coords.longitude, label: 'Your location' }),
      () => undefined,
      { timeout: 8000 },
    );

  const sun = now ? bodyHorizon('Sun', observer, now) : null;
  const lst = now ? localSiderealHours(now, observer.lonDeg) : 0;
  const hms = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}m`;

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 mx-auto">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="relative aspect-square w-full max-w-[640px] mx-auto overflow-hidden rounded-2xl border border-slate-800 bg-black">
            {bust > 0 && load !== 'failed' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${code}-${bust}`}
                src={sdoUrl(code, 1024, bust)}
                alt={`Latest SDO image, ${filter.label}`}
                onLoad={() => setLoad('live')}
                onError={() => setLoad('failed')}
                className="absolute inset-0 object-contain w-full h-full"
              />
            )}
            {load === 'failed' && <SimSun tint={filter.tint} />}
            <div className="absolute top-3 left-3">
              {load === 'failed' ? (
                <ModeBadge mode="SIM" note="NASA SDO could not be reached; this is a placeholder, not a solar image" />
              ) : load === 'live' ? (
                <ModeBadge mode="LIVE" note="Latest image from NASA Solar Dynamics Observatory (sdo.gsfc.nasa.gov)" />
              ) : (
                <span className="text-[10px] tracking-[0.2em] uppercase text-slate-500">Contacting SDO…</span>
              )}
            </div>
          </div>
          {load === 'failed' && (
            <p className="mt-3 text-xs text-fuchsia-200/80">
              Could not load imagery from sdo.gsfc.nasa.gov. What you see is a SIM placeholder, not the Sun right now.
            </p>
          )}
          <p className="mt-3 text-[11px] text-center text-slate-500">
            Image: NASA/SDO and the AIA, EVE and HMI science teams. Re-fetched every 5 minutes; the source updates about every 15.
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">Lens filter</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {SDO_FILTERS.map((f) => (
                <button
                  key={f.code}
                  onClick={() => {
                    setCode(f.code);
                    setLoad('loading');
                  }}
                  aria-pressed={f.code === code}
                  className={`h-9 px-1 text-[11px] rounded border transition ${f.code === code ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">{filter.note}</p>
            {code !== 'HMIIF' && code !== 'HMIB' && (
              <p className="mt-2 text-[11px] text-slate-500">AIA channels are invisible wavelengths, so the colours are a convention applied by NASA.</p>
            )}
          </div>

          <div className="p-4 border rounded-2xl border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">Sun from here (computed)</p>
              <button onClick={locate} className="flex items-center gap-1 text-[10px] uppercase text-cyan-300 hover:text-cyan-200">
                <LocateFixed className="w-3 h-3" /> Locate
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{observer.label}</p>
            {sun && (
            <dl className="grid grid-cols-2 mt-3 text-[11px] gap-y-1.5 tabular-nums">
              <dt className="text-slate-500">Altitude</dt>
              <dd className="text-right">{sun.altDeg.toFixed(1)}° {sun.altDeg < 0 ? '(below horizon)' : ''}</dd>
              <dt className="text-slate-500">Azimuth</dt>
              <dd className="text-right">{sun.azDeg.toFixed(1)}°</dd>
              <dt className="text-slate-500">RA / Dec</dt>
              <dd className="text-right">{hms(sun.raHours)} / {sun.decDeg.toFixed(2)}°</dd>
              <dt className="text-slate-500">Local sidereal</dt>
              <dd className="text-right">{hms(lst)}</dd>
            </dl>
            )}
            <p className="mt-3 text-[10px] text-slate-600">Ephemeris math (astronomy-engine), not an instrument reading.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
