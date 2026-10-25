import SiteHeader from '@/components/astroSim/SiteHeader';
import ProbeView from '@/components/astroSim/ProbeView';

export const metadata = { title: 'Probe Drop · Astro Simulator' };

export default function ProbePage() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Probe Drop" title="Venus and Jupiter descent" mode="SIM" modeNote="A game. Not mission data" sub />
      <ProbeView />
    </div>
  );
}
