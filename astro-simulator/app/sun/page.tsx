import SiteHeader from '@/components/SiteHeader';
import SunView from '@/components/sun/SunView';

export const metadata = { title: 'Live Sun · Astro Simulator' };

export default function SunPage() {
  return (
    <div className="min-h-dvh bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Live Sun" title="Solar Dynamics Observatory" />
      <SunView />
    </div>
  );
}
