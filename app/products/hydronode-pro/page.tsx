import HardwareProductDetail from '@/components/HardwareProductDetail';
import HydroNodeDashboard from '@/components/HydroNodeDashboard';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

const product = HARDWARE_PRODUCTS.find((p) => p.id === 'hydronode-pro')!;

export default function HydroNodeProPage() {
  return (
    <div className="bg-[#0a0a0c]">
      <HardwareProductDetail product={product} />
      <div className="px-6 pb-16">
        <HydroNodeDashboard />
      </div>
    </div>
  );
}
