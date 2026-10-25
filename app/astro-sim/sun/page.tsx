import SiteHeader from '@/components/astroSim/SiteHeader';
import SunView from '@/components/astroSim/SunView';

export const metadata = { title: 'Live Sun · Astro Simulator' };

export default function SunPage() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Live Sun" title="Solar Dynamics Observatory" sub />
      <SunView />
    </div>
  );
}
