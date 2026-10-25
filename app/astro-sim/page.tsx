import Link from 'next/link';
import SiteHeader from '@/components/astroSim/SiteHeader';

export const metadata = { title: 'Astro Simulator · Ai One' };

// Landing page: three full-bleed picture tiles with just a title, in the
// style of the Space Engine universe page. Each view keeps its own
// LIVE / ENHANCED / SIM badge once you open it (see SiteHeader and the views).
// Backgrounds: the real NASA Moon map, the latest NASA SDO 304 Å frame (falls
// back to black if NASA is unreachable), and a CSS-drawn banded gas giant.
const TILES: { href: string; title: string; bg: string; size: string; position: string; sunImg?: string }[] = [
  {
    href: '/astro-sim/moon',
    title: 'Moon Grid',
    bg: 'url(/textures/moon.jpg)',
    size: 'cover',
    position: '50% 42%',
  },
  {
    href: '/astro-sim/sun',
    title: 'Live Sun',
    bg: '',
    size: 'contain',
    position: 'center',
    sunImg: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg',
  },
  {
    href: '/astro-sim/probe',
    title: 'Probe Drop',
    bg: 'linear-gradient(180deg,#1b1209 0%,#6b4a2a 14%,#c9a06a 24%,#8a5a34 34%,#d8b98a 46%,#7a4a2c 58%,#c28d58 70%,#5a3a22 84%,#1b1209 100%)',
    size: 'cover',
    position: 'center',
  },
];

// Astro Simulator landing page. Same pattern as /flight-school: a real route
// in this app that scrolls inside its own fixed layer (body is overflow:hidden).
export default function AstroSimPage() {
  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Astro Simulator" title="Ai One Virtual Observatory" />
      <main className="grid flex-1 min-h-0 grid-rows-3 sm:grid-rows-1 sm:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-label={t.title}
            className="relative flex items-center justify-center overflow-hidden group border border-slate-800/60 bg-black"
          >
            {t.sunImg ? (
              // NASA's frame has a small caption baked into its bottom edge; the
              // square wrapper is clipped so only the Sun itself is shown.
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center transition duration-500 opacity-60 group-hover:opacity-95"
                style={{ containerType: 'size' }}
              >
                <div style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)', clipPath: 'inset(0 0 9% 0)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.sunImg} alt="" className="object-contain w-full h-full" />
                </div>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 transition duration-500 opacity-55 group-hover:opacity-90 group-hover:scale-[1.03]"
                style={{ backgroundImage: t.bg, backgroundSize: t.size, backgroundPosition: t.position, backgroundRepeat: 'no-repeat' }}
              />
            )}
            <span className="relative text-sm tracking-[0.4em] text-center text-white uppercase sm:text-base">
              {t.title}
              <span className="block w-8 h-px mx-auto mt-3 bg-white" />
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
