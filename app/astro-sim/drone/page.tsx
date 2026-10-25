import SiteHeader from '@/components/astroSim/SiteHeader';
import DroneView from '@/components/astroSim/DroneView';

export const metadata = { title: 'Space Drone · Astro Simulator' };

export default function SpaceDronePage() {
  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-[#07090E] text-slate-100 font-mono">
      <SiteHeader eyebrow="Space Drone" title="Shuttle-class flight" mode="SIM" modeNote="Simulated vehicle and flight, Moon not to scale. The Moon surface is NASA imagery." sub />
      <DroneView />
    </div>
  );
}
