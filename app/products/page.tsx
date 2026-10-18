import Link from 'next/link';
import { Home } from 'lucide-react';
import DroneSimulator from '@/components/products/DroneSimulator';

// Was BeatBrokerz/SoundClick's placeholder — that's promoted through social
// media now instead (see the dashboard card), freeing this slot up for a
// real product: an open-source, browser-based 3D virtual drone simulator
// (CesiumJS). The Home link floats on top of DroneSimulator's own
// full-viewport Cesium canvas rather than wrapping it in this page's own
// layout chrome, since the simulator needs the whole screen.
export default function ProductsPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Link
        href="/"
        aria-label="Home"
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
      >
        <Home className="w-3.5 h-3.5" />
        Home
      </Link>
      <DroneSimulator />
    </div>
  );
}
