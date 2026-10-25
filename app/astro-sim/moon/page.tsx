import SiteHeader from '@/components/astroSim/SiteHeader';
import MoonView from '@/components/astroSim/MoonView';

export const metadata = { title: 'Moon Grid · Astro Simulator' };

export default function MoonPage() {
  return (
    <div className="fixed inset-0 flex flex-col w-full h-full overflow-y-auto bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Moon Grid Mode" title="Lunar targeting" sub />
      <MoonView />
    </div>
  );
}
