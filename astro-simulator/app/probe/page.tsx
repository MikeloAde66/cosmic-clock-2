import SiteHeader from '@/components/SiteHeader';
import ProbeView from '@/components/probe/ProbeView';

export const metadata = { title: 'Probe Drop · Astro Simulator' };

export default function ProbePage() {
  return (
    <div className="min-h-dvh bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Probe Drop" title="Venus and Jupiter descent" mode="SIM" modeNote="A game. Not mission data" />
      <ProbeView />
    </div>
  );
}
