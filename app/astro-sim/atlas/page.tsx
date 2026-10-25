import SiteHeader from '@/components/astroSim/SiteHeader';
import AtlasView from '@/components/astroSim/AtlasView';

export const metadata = { title: 'Planet Atlas · Astro Simulator' };

export default function AtlasPage() {
  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Planet Atlas" title="Real NASA maps and sourced facts" sub />
      <AtlasView />
    </div>
  );
}
