import SiteHeader from '@/components/SiteHeader';
import MoonView from '@/components/moon/MoonView';

export const metadata = { title: 'Moon Grid · Astro Simulator' };

export default function MoonPage() {
  return (
    <div className="min-h-dvh bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Moon Grid Mode" title="Lunar targeting" />
      <MoonView />
    </div>
  );
}
