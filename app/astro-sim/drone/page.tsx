import DroneView from '@/components/astroSim/DroneView';

export const metadata = { title: 'Space Drone · Astro Simulator' };

// DroneView draws the site header itself: in the wide canopy cockpit the
// header crossbeam takes its place during flight.
export default function SpaceDronePage() {
  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-[#07090E] text-slate-100 font-mono">
      <DroneView />
    </div>
  );
}
