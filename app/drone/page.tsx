import Link from 'next/link';
import { Home, Plane, GraduationCap, Search, Camera, Map as MapIcon, ShoppingBag, BadgeCheck, ArrowUpRight } from 'lucide-react';
import { GEAR, CERTIFICATION } from '@/lib/drone/gear';

// AiOne Drone: landing page for everything drone in the hub. Points at the
// two real experiences (the 3D drone sim and the Flight Academy), the
// academy's mission lessons, and recommended gear + certification links.
// Gear and course links live in lib/drone/gear.ts so affiliate URLs can be
// added there without touching this page.

const MISSIONS = [
  {
    icon: Search,
    title: 'Search & Rescue',
    text: 'Switch the camera to thermal, let the AI detector flag heat signatures, and lock on to two people in a search area.',
    href: '/flight-school/train/search-rescue',
  },
  {
    icon: Camera,
    title: 'Cinematic Orbit',
    text: 'Aim the gimbal and fly a smooth 360° orbit around a subject, scored on how steady your hands are.',
    href: '/flight-school/train/aerial-photo',
  },
  {
    icon: MapIcon,
    title: 'Autonomous Mapping',
    text: 'Plan a waypoint mission, launch it on AUTO, and supervise it all the way home.',
    href: '/flight-school/train/mapping',
  },
];

function SectionHeading({ id, icon: Icon, title, note }: { id: string; icon: typeof Plane; title: string; note?: string }) {
  return (
    <div id={id} className="flex flex-wrap items-end justify-between gap-3 mb-6 scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-wide text-white sm:text-2xl">
        <Icon className="w-5 h-5 text-cyan-400" />
        {title}
      </h2>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}

export default function DronePage() {
  return (
    // body is overflow:hidden globally, so this page scrolls in its own layer.
    <div className="fixed inset-0 overflow-y-auto bg-[#020617] text-slate-100 font-mono">
      <header className="sticky top-0 z-50 border-b border-cyan-500/20 bg-slate-900/70 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-4 py-3 mx-auto max-w-7xl sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-6 h-6 border-2 rounded border-cyan-400">
              <div className="w-2 h-2 rounded-sm bg-cyan-400 animate-pulse" />
            </div>
            <span className="text-base font-bold tracking-wider text-white sm:text-lg">
              AiOne <span className="text-cyan-400">DRONE</span>
            </span>
          </div>

          <nav className="items-center hidden gap-7 text-sm md:flex text-slate-300">
            <a href="#fly" className="transition hover:text-cyan-400">Fly</a>
            <a href="#missions" className="transition hover:text-cyan-400">Missions</a>
            <a href="#gear" className="transition hover:text-cyan-400">Gear</a>
            <a href="#certify" className="transition hover:text-cyan-400">Get Certified</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/drone-sim"
              className="hidden px-4 py-2 text-sm font-bold text-white transition rounded-lg shadow-lg sm:inline-block bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500"
            >
              Open Simulator
            </Link>
            <Link
              href="/"
              aria-label="Home"
              className="flex items-center gap-1.5 h-9 px-3 text-[11px] uppercase tracking-wide rounded-lg border bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-10 mx-auto max-w-7xl sm:px-8 sm:py-12">
        {/* Hero */}
        <div className="grid items-center grid-cols-1 gap-8 p-6 border shadow-2xl lg:grid-cols-12 bg-slate-900/40 border-cyan-500/20 rounded-2xl sm:p-8 backdrop-blur-xl">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center px-3 py-1 text-xs border rounded-full bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
              DRONE SIMULATOR · FLIGHT ACADEMY · GEAR
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white lg:text-6xl text-balance">
              Fly anywhere.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">Learn it right.</span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
              Fly a virtual drone over photorealistic 3D cities, train step by step in the{' '}
              <strong className="text-white">Spectre-AI flight simulator</strong>, then pick the gear and certification
              you need to fly for real.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-cyan-500/20">
              {(
                [
                  ['Cities', '10', 'text-cyan-400'],
                  ['Lessons', '13', 'text-emerald-400'],
                  ['To try', 'Free', 'text-purple-400'],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className="p-3 border rounded-xl bg-slate-950/60 border-cyan-500/20">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview card */}
          <div className="overflow-hidden border shadow-2xl lg:col-span-5 bg-slate-950/80 border-cyan-500/30 rounded-xl">
            <div className="relative flex items-center justify-center h-64 overflow-hidden bg-slate-900">
              <div className="absolute inset-0 bg-center bg-cover opacity-60" style={{ backgroundImage: 'url("/media/drone-hero.jpg")' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />

              <div className="absolute top-3 left-3 right-3 p-3 bg-slate-900/90 border border-cyan-500/30 rounded-lg backdrop-blur-md text-[11px] flex justify-between items-start gap-3">
                <div>
                  <div className="font-bold text-cyan-400">AiOne Virtual Drone HUD</div>
                  <div className="text-slate-300">
                    Altitude: <span className="font-semibold text-white">80 m</span> | Heading:{' '}
                    <span className="font-semibold text-white">045°</span>
                  </div>
                  <div className="text-slate-300">
                    Cam: <span className="font-semibold text-amber-400">Chase-Cam</span> | View:{' '}
                    <span className="font-semibold text-white">Earth + Labels</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[9px] border border-emerald-500/30">
                    LIVE WEATHER
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">Charleston, SC</div>
                </div>
              </div>

              <div className="flex items-center justify-center w-20 h-20 border rounded-full border-cyan-400/60 motion-safe:animate-pulse">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[10px] bg-slate-900/90 border border-cyan-500/30 px-3 py-1.5 rounded-lg backdrop-blur-md">
                <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-bold">WASD</span> Fly
                <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-bold">Space/Shift</span> Climb
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 border-t bg-slate-900 border-cyan-500/20">
              <Link
                href="/drone-sim"
                className="px-4 py-2.5 text-center text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-md shadow-cyan-500/20"
              >
                OPEN SIMULATOR
              </Link>
              <Link
                href="/flight-school"
                className="px-4 py-2.5 text-center text-xs font-bold rounded-lg border border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hover:text-white transition"
              >
                FLIGHT ACADEMY
              </Link>
            </div>
          </div>
        </div>

        {/* Fly */}
        <section className="mt-16">
          <SectionHeading id="fly" icon={Plane} title="Fly" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Link
              href="/drone-sim"
              className="p-6 transition border rounded-xl bg-slate-900/60 backdrop-blur-md border-cyan-500/20 hover:border-cyan-400"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 border rounded-lg bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                  <Plane className="w-5 h-5" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold">Open now</span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">Drone Simulator</h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-400">
                Photorealistic 3D cities from Charleston to Tokyo. Each city opens into live hot spots, restaurants,
                nightlife, hotels and airports from Google Maps, with live weather for the flight.
              </p>
              <div className="flex items-center justify-between pt-4 text-xs font-semibold border-t text-cyan-400 border-cyan-500/20">
                <span>Earth 3D · Labels · Vector</span>
                <span>→ Fly</span>
              </div>
            </Link>

            <Link
              href="/flight-school"
              className="p-6 transition border rounded-xl bg-slate-900/60 backdrop-blur-md border-cyan-500/20 hover:border-purple-400"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 text-purple-400 border rounded-lg bg-purple-500/10 border-purple-500/30">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-bold">13 lessons</span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">Flight Academy</h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-400">
                Start with a hands-on flight evaluation, then learn aerodynamics, failsafes and real missions inside the
                Spectre-AI simulator. Every lesson is passed by flying it.
              </p>
              <div className="flex items-center justify-between pt-4 text-xs font-semibold text-purple-400 border-t border-cyan-500/20">
                <span>Evaluation → 3 modules → Wings</span>
                <span>→ Start</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Missions */}
        <section className="mt-16">
          <SectionHeading id="missions" icon={Search} title="Training Missions" note="Flown in the Spectre-AI simulator" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {MISSIONS.map((m) => (
              <Link
                key={m.title}
                href={m.href}
                className="flex flex-col p-6 transition border rounded-xl bg-slate-900/60 border-cyan-500/20 hover:border-cyan-400"
              >
                <div className="self-start p-3 mb-4 border rounded-lg bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                  <m.icon className="w-5 h-5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{m.title}</h3>
                <p className="flex-1 text-xs leading-relaxed text-slate-400">{m.text}</p>
                <span className="pt-4 mt-4 text-xs font-semibold border-t text-cyan-400 border-cyan-500/20">→ Fly this mission</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Gear */}
        <section className="mt-16">
          <SectionHeading
            id="gear"
            icon={ShoppingBag}
            title="Gear"
            note="Some links may be affiliate links: we may earn a commission at no extra cost to you."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GEAR.map((g) => {
              const body = (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{g.tag}</span>
                    {g.href ? (
                      <ArrowUpRight className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-slate-600">Link coming soon</span>
                    )}
                  </div>
                  <h3 className="mb-1.5 text-sm font-bold text-white">{g.name}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{g.why}</p>
                </>
              );
              return g.href ? (
                <a
                  key={g.name}
                  href={g.href}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="p-5 transition border rounded-xl bg-slate-900/60 border-cyan-500/20 hover:border-cyan-400"
                >
                  {body}
                </a>
              ) : (
                <div key={g.name} className="p-5 border rounded-xl bg-slate-900/40 border-slate-800">
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        {/* Certification */}
        <section className="mt-16">
          <SectionHeading id="certify" icon={BadgeCheck} title="Get Certified" note="Official FAA pages are free" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CERTIFICATION.map((c) => {
              const body = (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white">{c.name}</h3>
                    {c.href ? (
                      <span className="flex items-center gap-1 text-[11px] text-cyan-300">
                        {c.cta} <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-slate-600">Link coming soon</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{c.why}</p>
                </>
              );
              return c.href ? (
                <a
                  key={c.name}
                  href={c.href}
                  target="_blank"
                  rel={c.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
                  className="p-5 transition border rounded-xl bg-slate-900/60 border-cyan-500/20 hover:border-cyan-400"
                >
                  {body}
                </a>
              ) : (
                <div key={c.name} className="p-5 border rounded-xl bg-slate-900/40 border-slate-800">
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80">
        <div className="px-4 py-6 mx-auto space-y-2 text-[11px] leading-relaxed max-w-7xl sm:px-8 text-slate-500">
          <p>
            Affiliate disclosure: some gear and course links on this page may be affiliate links, and Ai One may earn a
            commission if you buy through them, at no extra cost to you.
          </p>
          <p>
            The simulator and Flight Academy are training tools, not an FAA credential or authorization to fly. US
            recreational flyers must pass the free TRUST test; flying for work or business requires a Part 107 Remote
            Pilot Certificate. Always check airspace before you fly.
          </p>
        </div>
      </footer>
    </div>
  );
}
